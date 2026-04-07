"""
benchmark_clustering.py — State-of-the-art clustering benchmark on CRM RFM data.

Answers: "Which algorithm best segments our customers WITHOUT knowing true labels?"

Key insight: Without ground truth, we combine 4 independent evaluation angles:
  1. Geometric quality   — Silhouette, Davies-Bouldin, Calinski-Harabasz
  2. Cluster tendency    — Hopkins statistic (is the data even clusterable?)
  3. Stability           — Bootstrap consensus (does the clustering reproduce?)
  4. Business validity   — Do segments predict delivery rates? (our proxy label)

Usage:
  cd ml-service
  python benchmark_clustering.py
"""

import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings("ignore")

# ── Load RFM from database ───────────────────────────────────────────────────
print("=" * 65)
print("CLUSTERING BENCHMARK — CRM RFM Data")
print("=" * 65)

import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(Path(__file__).parent))
from app.services.data_service import data_service
from app.routes.retrain import _prepare_database_data

df = data_service.load_orders()
df = _prepare_database_data(df)

reference_date = df["order_date"].max() + pd.Timedelta(days=1)
rfm = df.groupby("customer_unique_id").agg(
    recency   = ("order_date",    lambda x: (reference_date - x.max()).days),
    frequency = ("order_id",      "count"),
    monetary  = ("total_amount",  "sum"),
    success_rate = ("is_delivered", "mean"),   # business proxy label
).reset_index()

print(f"\nCustomers: {len(rfm):,}  |  date range: {df['order_date'].min().date()} — {df['order_date'].max().date()}")

from sklearn.preprocessing import StandardScaler
scaler   = StandardScaler()
X        = scaler.fit_transform(rfm[["recency", "frequency", "monetary"]])
X_raw    = rfm[["recency", "frequency", "monetary"]].values

# ── 1. Hopkins statistic — is the data clusterable at all? ──────────────────
def hopkins_statistic(X, n_samples=100, seed=42):
    """H close to 1 = highly clusterable, H near 0.5 = random, H near 0 = uniform."""
    rng = np.random.default_rng(seed)
    n, d = X.shape
    n_samples = min(n_samples, n // 5)
    from sklearn.neighbors import NearestNeighbors
    nn = NearestNeighbors(n_neighbors=2).fit(X)

    # Real data: nearest-neighbor distances
    idx  = rng.choice(n, n_samples, replace=False)
    dists_real, _ = nn.kneighbors(X[idx], n_neighbors=2)
    u = dists_real[:, 1]

    # Random reference: uniform random points in same bounding box
    mins, maxs = X.min(axis=0), X.max(axis=0)
    rand_pts   = rng.uniform(mins, maxs, (n_samples, d))
    dists_rand, _ = nn.kneighbors(rand_pts, n_neighbors=1)
    w = dists_rand[:, 0]

    H = w.sum() / (u.sum() + w.sum())
    return round(float(H), 4)

H = hopkins_statistic(X)
tendency = "Strong" if H > 0.75 else "Moderate" if H > 0.55 else "Weak"
print(f"\n[1] Hopkins Statistic: {H}  ->  {tendency} cluster tendency")
print("    (>0.75 = strong, >0.55 = moderate, ~0.5 = random noise)")

# ── 2. Internal evaluation metrics ──────────────────────────────────────────
from sklearn.metrics import (
    silhouette_score, davies_bouldin_score, calinski_harabasz_score
)

def evaluate(X, labels, name=""):
    """Return dict of all internal metrics (ignores noise=-1 points)."""
    mask   = labels != -1
    X_m    = X[mask]
    lab_m  = labels[mask]
    n_clus = len(set(lab_m))
    noise  = (labels == -1).sum()

    if n_clus < 2 or len(X_m) < n_clus + 1:
        return {"algorithm": name, "n_clusters": n_clus, "noise_pts": int(noise),
                "silhouette": -1, "davies_bouldin": 99, "calinski_harabasz": 0,
                "balance_score": 0, "notes": "too few clusters"}

    sil  = round(silhouette_score(X_m, lab_m), 4)
    db   = round(davies_bouldin_score(X_m, lab_m), 4)
    ch   = round(calinski_harabasz_score(X_m, lab_m), 1)

    # Cluster balance: how evenly sized are the clusters? (1 = perfect)
    sizes  = np.bincount(lab_m)
    ideal  = len(X_m) / n_clus
    balance = round(1 - np.std(sizes) / (ideal + 1e-9) / np.sqrt(n_clus), 4)
    balance = max(0.0, balance)

    return {
        "algorithm":         name,
        "n_clusters":        n_clus,
        "noise_pts":         int(noise),
        "silhouette":        sil,       # higher = better (max 1)
        "davies_bouldin":    db,        # lower  = better (min 0)
        "calinski_harabasz": ch,        # higher = better
        "balance_score":     balance,   # higher = more even sizes
        "notes":             "",
    }

# ── 3. Stability via bootstrap consensus ───────────────────────────────────
def stability_score(algo_fn, X, n_boot=10, seed=42):
    """
    Run algo_fn n_boot times on 80% bootstrap samples.
    Measure average adjusted-rand-index between pairs -> higher = more stable.
    """
    from sklearn.metrics import adjusted_rand_score
    rng    = np.random.default_rng(seed)
    n      = len(X)
    labels_list = []
    for _ in range(n_boot):
        idx  = rng.choice(n, int(0.8 * n), replace=False)
        try:
            lab  = algo_fn(X[idx])
            sort_ord = np.argsort(idx)
            labels_list.append((idx[sort_ord], lab[sort_ord]))
        except Exception:
            pass
    if len(labels_list) < 2:
        return 0.0

    scores = []
    for i in range(len(labels_list)):
        for j in range(i + 1, len(labels_list)):
            idx_i, lab_i = labels_list[i]
            idx_j, lab_j = labels_list[j]
            common = np.intersect1d(idx_i, idx_j)
            if len(common) < 10:
                continue
            a = lab_i[np.searchsorted(idx_i, common)]
            b = lab_j[np.searchsorted(idx_j, common)]
            scores.append(adjusted_rand_score(a, b))
    return round(float(np.mean(scores)) if scores else 0.0, 4)

# ── 4. Business validity — do segments predict delivery rate? ───────────────
def business_validity(rfm_with_labels, label_col="cluster"):
    """
    Compute variance of delivery success_rate across clusters.
    Higher variance = clusters differ meaningfully in business outcome.
    """
    grp = rfm_with_labels.groupby(label_col)["success_rate"].mean()
    return round(float(grp.var()), 6)

# ================================================══════════════════════
# ALGORITHMS
# ================================================══════════════════════

results = []

# ── A. KMeans — Elbow + Silhouette to choose K ──────────────────────────────
print("\n" + "─" * 65)
print("A. KMeans  (Elbow + Silhouette auto-K)")
from sklearn.cluster import KMeans

k_range = range(2, min(12, len(X) // 20))
inertias, sils = [], []
for k in k_range:
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    lab = km.fit_predict(X)
    inertias.append(km.inertia_)
    sils.append(silhouette_score(X, lab))

# Elbow: largest second derivative
elbows = np.diff(np.diff(inertias))
elbow_k = list(k_range)[np.argmax(elbows) + 1]

# Max silhouette
sil_k = list(k_range)[np.argmax(sils)]

print(f"   Elbow method -> K={elbow_k}  |  Silhouette method → K={sil_k}")
best_k = sil_k   # silhouette is generally more reliable

km_best = KMeans(n_clusters=best_k, random_state=42, n_init=10)
labels_km = km_best.fit_predict(X)
res_km = evaluate(X, labels_km, f"KMeans (K={best_k})")
res_km["stability"] = stability_score(
    lambda Xs: KMeans(n_clusters=best_k, random_state=42, n_init=5).fit_predict(Xs), X)
rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_km
res_km["biz_validity"] = business_validity(rfm_tmp)
results.append(res_km)
print(f"   -> K={best_k}  Sil={res_km['silhouette']}  DB={res_km['davies_bouldin']}  CH={res_km['calinski_harabasz']}")

# ── B. KMeans++ with Gap Statistic ──────────────────────────────────────────
print("\n─── B. KMeans++ with Gap Statistic ────────────────────")
def gap_statistic(X, k_max=10, n_refs=10, seed=42):
    """Gap statistic: choose K where gap(K) - gap(K+1) + std(K+1) > 0"""
    rng = np.random.default_rng(seed)
    gaps, stds = [], []
    for k in range(1, k_max + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=5)
        km.fit(X)
        Wk = np.log(km.inertia_ + 1e-9)
        ref_inertias = []
        for _ in range(n_refs):
            rand_X = rng.uniform(X.min(axis=0), X.max(axis=0), X.shape)
            ref_km = KMeans(n_clusters=k, random_state=42, n_init=3)
            ref_km.fit(rand_X)
            ref_inertias.append(np.log(ref_km.inertia_ + 1e-9))
        gap  = np.mean(ref_inertias) - Wk
        gaps.append(gap)
        stds.append(np.std(ref_inertias))
    # First K where gap(K) >= gap(K+1) - std(K+1)
    for k in range(len(gaps) - 1):
        if gaps[k] >= gaps[k + 1] - stds[k + 1]:
            return k + 1
    return k_max

gap_k = gap_statistic(X, k_max=min(8, len(X) // 20))
print(f"   Gap statistic -> K={gap_k}")
labels_gap = KMeans(n_clusters=gap_k, random_state=42, n_init=10).fit_predict(X)
res_gap = evaluate(X, labels_gap, f"KMeans-Gap (K={gap_k})")
res_gap["stability"] = stability_score(
    lambda Xs: KMeans(n_clusters=gap_k, random_state=42, n_init=5).fit_predict(Xs), X)
rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_gap
res_gap["biz_validity"] = business_validity(rfm_tmp)
results.append(res_gap)
print(f"   -> K={gap_k}  Sil={res_gap['silhouette']}  DB={res_gap['davies_bouldin']}")

# ── C. HDBSCAN — sweep min_cluster_size ─────────────────────────────────────
print("\n─── C. HDBSCAN (min_cluster_size sweep) ───────────────")
import hdbscan as _hdbscan

best_hdb = None
best_hdb_sil = -1
mcs_range = [10, 20, 30, 50, 80, 100, 150] if len(X) >= 500 else [5, 10, 15, 20, 30]
for mcs in mcs_range:
    hdb = _hdbscan.HDBSCAN(min_cluster_size=mcs, min_samples=5, metric="euclidean",
                             cluster_selection_method="eom")
    lab = hdb.fit_predict(X)
    n_c = len(set(lab) - {-1})
    noise = (lab == -1).mean()
    if n_c >= 2 and noise < 0.4:
        mask = lab != -1
        sil = silhouette_score(X[mask], lab[mask]) if mask.sum() > n_c else -1
        print(f"   mcs={mcs:3d}: {n_c} clusters, {noise:.1%} noise, sil={sil:.4f}")
        if sil > best_hdb_sil:
            best_hdb_sil = sil
            best_hdb = (mcs, lab, n_c)
    else:
        print(f"   mcs={mcs:3d}: {n_c} clusters, {noise:.1%} noise — skipped")

if best_hdb:
    mcs_opt, labels_hdb, n_hdb = best_hdb
    # Reassign noise to nearest cluster centroid
    noise_mask = labels_hdb == -1
    if noise_mask.any():
        from scipy.spatial.distance import cdist
        cluster_ids = sorted(set(labels_hdb) - {-1})
        centroids = np.array([X[labels_hdb == c].mean(axis=0) for c in cluster_ids])
        dists_n = cdist(X[noise_mask], centroids)
        labels_hdb[noise_mask] = [cluster_ids[i] for i in np.argmin(dists_n, axis=1)]
    res_hdb = evaluate(X, labels_hdb, f"HDBSCAN (mcs={mcs_opt})")
    res_hdb["stability"] = stability_score(
        lambda Xs: _hdbscan.HDBSCAN(min_cluster_size=mcs_opt, min_samples=5).fit_predict(Xs), X)
    rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_hdb
    res_hdb["biz_validity"] = business_validity(rfm_tmp)
    results.append(res_hdb)
    print(f"   Best mcs={mcs_opt} -> Sil={res_hdb['silhouette']}  DB={res_hdb['davies_bouldin']}")
else:
    print("   HDBSCAN: no valid configuration found")

# ── D. DBSCAN — k-NN knee point for eps ─────────────────────────────────────
print("\n─── D. DBSCAN (k-NN knee point for eps) ───────────────")
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors

min_pts = max(4, int(np.log(len(X))))
nbrs = NearestNeighbors(n_neighbors=min_pts).fit(X)
dists, _ = nbrs.kneighbors(X)
k_dists = np.sort(dists[:, -1])[::-1]

# Knee detection via maximum curvature
def knee_point(y):
    n = len(y)
    x = np.arange(n)
    p1, p2 = np.array([x[0], y[0]]), np.array([x[-1], y[-1]])
    line = p2 - p1
    dists_line = np.abs(np.cross(line, p1 - np.column_stack([x, y]))) / np.linalg.norm(line)
    return int(x[np.argmax(dists_line)])

knee_idx = knee_point(k_dists)
eps_opt  = round(float(k_dists[knee_idx]), 4)
print(f"   min_pts={min_pts}, knee -> eps={eps_opt}")

labels_dbscan = DBSCAN(eps=eps_opt, min_samples=min_pts).fit_predict(X)
n_c_dbscan = len(set(labels_dbscan) - {-1})
noise_dbscan = (labels_dbscan == -1).mean()
print(f"   DBSCAN: {n_c_dbscan} clusters, {noise_dbscan:.1%} noise")
if n_c_dbscan >= 2:
    res_dbs = evaluate(X, labels_dbscan, f"DBSCAN (eps={eps_opt})")
    # Reassign noise
    noise_mask = labels_dbscan == -1
    labels_clean = labels_dbscan.copy()
    if noise_mask.any() and n_c_dbscan >= 2:
        from scipy.spatial.distance import cdist
        cluster_ids = sorted(set(labels_dbscan) - {-1})
        centroids = np.array([X[labels_dbscan == c].mean(axis=0) for c in cluster_ids])
        dists_n = cdist(X[noise_mask], centroids)
        labels_clean[noise_mask] = [cluster_ids[i] for i in np.argmin(dists_n, axis=1)]
        res_dbs = evaluate(X, labels_clean, f"DBSCAN (eps={eps_opt})")
    res_dbs["stability"] = stability_score(
        lambda Xs: DBSCAN(eps=eps_opt, min_samples=min_pts).fit_predict(Xs), X)
    rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_clean
    res_dbs["biz_validity"] = business_validity(rfm_tmp)
    results.append(res_dbs)
    print(f"   -> Sil={res_dbs['silhouette']}  DB={res_dbs['davies_bouldin']}")
else:
    print("   DBSCAN: too few clusters — skipped")

# ── E. Gaussian Mixture Models — BIC/AIC to choose n_components ─────────────
print("\n─── E. GMM / Elliptic Envelope (BIC + AIC auto-K) ──────")
from sklearn.mixture import GaussianMixture

bics, aics = [], []
k_range_gmm = range(2, min(10, len(X) // 20))
for k in k_range_gmm:
    gmm = GaussianMixture(n_components=k, covariance_type="full", random_state=42)
    gmm.fit(X)
    bics.append(gmm.bic(X))
    aics.append(gmm.aic(X))

bic_k = list(k_range_gmm)[np.argmin(bics)]
aic_k = list(k_range_gmm)[np.argmin(aics)]
print(f"   BIC -> K={bic_k}  |  AIC → K={aic_k}")

for label_k, label_name in [(bic_k, "BIC"), (aic_k, "AIC")]:
    gmm = GaussianMixture(n_components=label_k, covariance_type="full", random_state=42)
    labels_gmm = gmm.fit_predict(X)
    res_gmm = evaluate(X, labels_gmm, f"GMM-{label_name} (K={label_k})")
    res_gmm["stability"] = stability_score(
        lambda Xs: GaussianMixture(n_components=label_k, random_state=42).fit_predict(Xs), X)
    rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_gmm
    res_gmm["biz_validity"] = business_validity(rfm_tmp)
    results.append(res_gmm)
    print(f"   GMM-{label_name} K={label_k}: Sil={res_gmm['silhouette']}  DB={res_gmm['davies_bouldin']}")

# ── F. Agglomerative — Ward linkage + dendrogram distance ───────────────────
print("\n─── F. Agglomerative Clustering (Ward, auto-cut) ───────")
from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import linkage, dendrogram, fcluster
from scipy.spatial.distance import pdist

Z = linkage(X, method="ward")
last_merges = Z[-20:, 2]
accel = np.diff(last_merges, 2)
# Optimal cut: largest acceleration of merge distances
agg_k = 20 - np.argmax(accel) + 1
agg_k = max(2, min(agg_k, 8))
print(f"   Dendrogram acceleration -> K={agg_k}")

labels_agg = AgglomerativeClustering(n_clusters=agg_k, linkage="ward").fit_predict(X)
res_agg = evaluate(X, labels_agg, f"Agglomerative-Ward (K={agg_k})")
res_agg["stability"] = stability_score(
    lambda Xs: AgglomerativeClustering(n_clusters=agg_k, linkage="ward").fit_predict(Xs), X)
rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_agg
res_agg["biz_validity"] = business_validity(rfm_tmp)
results.append(res_agg)
print(f"   -> Sil={res_agg['silhouette']}  DB={res_agg['davies_bouldin']}")

# ── G. OPTICS ────────────────────────────────────────────────────────────────
print("\n─── G. OPTICS ──────────────────────────────────────────")
from sklearn.cluster import OPTICS

min_s = max(5, len(X) // 100)
optics = OPTICS(min_samples=min_s, xi=0.05, min_cluster_size=0.05)
labels_optics = optics.fit_predict(X)
n_c_optics = len(set(labels_optics) - {-1})
noise_optics = (labels_optics == -1).mean()
print(f"   min_samples={min_s}: {n_c_optics} clusters, {noise_optics:.1%} noise")
if n_c_optics >= 2:
    noise_mask = labels_optics == -1
    labels_op_clean = labels_optics.copy()
    if noise_mask.any():
        from scipy.spatial.distance import cdist
        cluster_ids = sorted(set(labels_optics) - {-1})
        centroids = np.array([X[labels_optics == c].mean(axis=0) for c in cluster_ids])
        dists_n = cdist(X[noise_mask], centroids)
        labels_op_clean[noise_mask] = [cluster_ids[i] for i in np.argmin(dists_n, axis=1)]
    res_optics = evaluate(X, labels_op_clean, f"OPTICS (min_s={min_s})")
    rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_op_clean
    res_optics["biz_validity"] = business_validity(rfm_tmp)
    res_optics["stability"] = 0.0  # OPTICS is deterministic, skip bootstrap
    results.append(res_optics)
    print(f"   -> Sil={res_optics['silhouette']}  DB={res_optics['davies_bouldin']}")
else:
    print("   OPTICS: too few clusters — skipped")

# ── H. Spectral Clustering ──────────────────────────────────────────────────
print("\n─── H. Spectral Clustering (eigengap heuristic) ────────")
from sklearn.cluster import SpectralClustering
from sklearn.neighbors import kneighbors_graph

# Eigengap heuristic: build affinity matrix, eigenvalues of Laplacian
from sklearn.manifold import spectral_embedding
try:
    A = kneighbors_graph(X, n_neighbors=10, mode="connectivity", include_self=True)
    A = (A + A.T) / 2
    from scipy.sparse.csgraph import laplacian
    from scipy.sparse.linalg import eigsh
    L = laplacian(A, normed=True)
    eigenvalues, _ = eigsh(L, k=10, which="SM")
    eigenvalues = np.sort(eigenvalues)
    gaps = np.diff(eigenvalues)
    spectral_k = int(np.argmax(gaps[1:]) + 2)   # skip trivial gap at 0
    spectral_k = max(2, min(spectral_k, 8))
    print(f"   Eigengap heuristic -> K={spectral_k}")

    labels_spec = SpectralClustering(n_clusters=spectral_k, random_state=42,
                                      affinity="nearest_neighbors", n_neighbors=10).fit_predict(X)
    res_spec = evaluate(X, labels_spec, f"Spectral (K={spectral_k})")
    res_spec["stability"] = stability_score(
        lambda Xs: SpectralClustering(n_clusters=spectral_k, random_state=42,
                                       affinity="nearest_neighbors").fit_predict(Xs), X)
    rfm_tmp = rfm.copy(); rfm_tmp["cluster"] = labels_spec
    res_spec["biz_validity"] = business_validity(rfm_tmp)
    results.append(res_spec)
    print(f"   -> Sil={res_spec['silhouette']}  DB={res_spec['davies_bouldin']}")
except Exception as e:
    print(f"   Spectral: skipped ({e})")

# ================================================══════════════════════
# RANKING — composite score
# ================================================══════════════════════

print("\n" + "=" * 65)
print("RESULTS SUMMARY")
print("=" * 65)

df_res = pd.DataFrame(results)

# Normalize each metric to [0, 1] — higher is always better
df_res["sil_norm"]    = (df_res["silhouette"]        - df_res["silhouette"].min())        / (df_res["silhouette"].max()        - df_res["silhouette"].min() + 1e-9)
df_res["db_norm"]     = 1 - (df_res["davies_bouldin"]  - df_res["davies_bouldin"].min())   / (df_res["davies_bouldin"].max()    - df_res["davies_bouldin"].min() + 1e-9)
df_res["ch_norm"]     = (df_res["calinski_harabasz"]  - df_res["calinski_harabasz"].min()) / (df_res["calinski_harabasz"].max() - df_res["calinski_harabasz"].min() + 1e-9)
df_res["stab_norm"]   = (df_res["stability"]          - df_res["stability"].min())          / (df_res["stability"].max()         - df_res["stability"].min() + 1e-9)
df_res["biz_norm"]    = (df_res["biz_validity"]       - df_res["biz_validity"].min())       / (df_res["biz_validity"].max()      - df_res["biz_validity"].min() + 1e-9)
df_res["bal_norm"]    = (df_res["balance_score"]      - df_res["balance_score"].min())      / (df_res["balance_score"].max()     - df_res["balance_score"].min() + 1e-9)

# Weighted composite: geometric quality (50%), stability (25%), business (15%), balance (10%)
df_res["composite"] = (
    0.20 * df_res["sil_norm"]  +
    0.15 * df_res["db_norm"]   +
    0.15 * df_res["ch_norm"]   +
    0.25 * df_res["stab_norm"] +
    0.15 * df_res["biz_norm"]  +
    0.10 * df_res["bal_norm"]
).round(4)

df_res = df_res.sort_values("composite", ascending=False).reset_index(drop=True)

cols = ["algorithm", "n_clusters", "noise_pts", "silhouette",
        "davies_bouldin", "calinski_harabasz", "stability", "biz_validity", "composite"]

print(df_res[cols].to_string(index=True))

print("\n" + "─" * 65)
print(f"OK  WINNER:  {df_res.iloc[0]['algorithm']}")
print(f"   Composite score: {df_res.iloc[0]['composite']:.4f}")
print(f"   Silhouette:      {df_res.iloc[0]['silhouette']}")
print(f"   Davies-Bouldin:  {df_res.iloc[0]['davies_bouldin']}")
print(f"   Stability:       {df_res.iloc[0]['stability']}")
print(f"   Business val.:   {df_res.iloc[0]['biz_validity']:.6f}")
print("─" * 65)

# ── Answer the fundamental question ─────────────────────────────────────────
print("""
HOW WE EVALUATE WITHOUT KNOWING REAL SEGMENTS
==============================════════════════
We cannot know "true" clusters — they don't exist in nature.
We answer instead: "which partition is most useful and robust?"

  1. Silhouette   -> geometric separation (are clusters tight & far apart?)
  2. Davies-Bouldin -> cluster compactness vs scatter (lower = better)
  3. Calinski-Harabasz -> between/within variance ratio (higher = better)
  4. Hopkins stat  -> confirms data has cluster structure (not random)
  5. Stability     -> bootstrap ARI: same algo on 80% samples agrees?
  6. Business val. -> do segments predict delivery success rate?
                     (delivery rate is our observable business outcome)

  A cluster solution that scores high on ALL 6 is genuinely useful.
  Stability alone reveals algorithms that overfit noise.
  Business validity reveals whether segments are actionable.
""")

# Save results
out = Path(__file__).parent / "trained_models" / "clustering_benchmark.json"
df_res.loc[:, ~df_res.columns.duplicated()].to_json(out, orient="records", indent=2)
print(f"Results saved to {out}")
