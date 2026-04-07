"""
Mapping utilities to convert Olist Brazilian E-Commerce dataset
to COD-CRM compatible format.

Olist Dataset: https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce
"""

# Brazilian states → simulated Algerian wilayas mapping
# Maps the 27 Brazilian states to a subset of Algeria's 58 wilayas
STATE_TO_WILAYA = {
    "AC": {"id": 1, "name": "Adrar", "zone": "zone_3"},
    "AL": {"id": 2, "name": "Chlef", "zone": "zone_1"},
    "AM": {"id": 3, "name": "Laghouat", "zone": "zone_3"},
    "AP": {"id": 4, "name": "Oum El Bouaghi", "zone": "zone_2"},
    "BA": {"id": 5, "name": "Batna", "zone": "zone_2"},
    "CE": {"id": 6, "name": "Bejaia", "zone": "zone_1"},
    "DF": {"id": 7, "name": "Biskra", "zone": "zone_2"},
    "ES": {"id": 8, "name": "Bechar", "zone": "zone_3"},
    "GO": {"id": 9, "name": "Blida", "zone": "zone_1"},
    "MA": {"id": 10, "name": "Bouira", "zone": "zone_1"},
    "MG": {"id": 16, "name": "Alger", "zone": "zone_1"},
    "MS": {"id": 17, "name": "Djelfa", "zone": "zone_2"},
    "MT": {"id": 18, "name": "Jijel", "zone": "zone_1"},
    "PA": {"id": 19, "name": "Setif", "zone": "zone_1"},
    "PB": {"id": 20, "name": "Saida", "zone": "zone_2"},
    "PE": {"id": 21, "name": "Skikda", "zone": "zone_1"},
    "PI": {"id": 22, "name": "Sidi Bel Abbes", "zone": "zone_2"},
    "PR": {"id": 23, "name": "Annaba", "zone": "zone_1"},
    "RJ": {"id": 25, "name": "Constantine", "zone": "zone_1"},
    "RN": {"id": 26, "name": "Medea", "zone": "zone_1"},
    "RO": {"id": 27, "name": "Mostaganem", "zone": "zone_1"},
    "RR": {"id": 28, "name": "M'Sila", "zone": "zone_2"},
    "RS": {"id": 31, "name": "Oran", "zone": "zone_1"},
    "SC": {"id": 34, "name": "Bordj Bou Arreridj", "zone": "zone_2"},
    "SE": {"id": 35, "name": "Boumerdes", "zone": "zone_1"},
    "SP": {"id": 36, "name": "El Tarf", "zone": "zone_1"},
    "TO": {"id": 42, "name": "Tipaza", "zone": "zone_1"},
}

# Olist order statuses → CRM order statuses
STATUS_MAPPING = {
    "delivered": "delivered",
    "shipped": "shipped",
    "canceled": "cancelled",
    "unavailable": "cancelled",
    "invoiced": "processing",
    "processing": "processing",
    "created": "new",
    "approved": "confirmed",
}

# Product category translation (Portuguese → English)
CATEGORY_TRANSLATION = {
    "beleza_saude": "health_beauty",
    "informatica_acessorios": "computers_accessories",
    "automotivo": "automotive",
    "cama_mesa_banho": "bed_bath_table",
    "moveis_decoracao": "furniture_decor",
    "esporte_lazer": "sports_leisure",
    "perfumaria": "perfumery",
    "utilidades_domesticas": "housewares",
    "telefonia": "telephony",
    "relogios_presentes": "watches_gifts",
    "alimentos_bebidas": "food_drink",
    "bebes": "baby",
    "papelaria": "stationery",
    "tablets_impressao_imagem": "tablets_printing",
    "brinquedos": "toys",
    "telefonia_fixa": "fixed_telephony",
    "ferramentas_jardim": "garden_tools",
    "fashion_bolsas_e_acessorios": "fashion_bags_accessories",
    "eletroportateis": "small_appliances",
    "consoles_games": "consoles_games",
    "audio": "audio",
    "fashion_calcados": "fashion_shoes",
    "cool_stuff": "cool_stuff",
    "malas_acessorios": "luggage_accessories",
    "climatizacao": "air_conditioning",
    "construcao_ferramentas_construcao": "construction_tools",
    "moveis_cozinha_area_de_servico_jantar_e_jardim": "kitchen_furniture",
    "construcao_ferramentas_iluminacao": "construction_lighting",
    "fashion_roupa_masculina": "fashion_male_clothing",
    "pet_shop": "pet_shop",
    "moveis_escritorio": "office_furniture",
    "market_place": "marketplace",
    "eletronicos": "electronics",
    "eletrodomesticos": "home_appliances",
    "artigos_de_festas": "party_supplies",
    "pcs": "computers",
    "sinalizacao_e_seguranca": "signage_safety",
    "construcao_ferramentas_jardim": "garden_construction",
    "fashion_roupa_feminina": "fashion_female_clothing",
    "livros_interesse_geral": "general_interest_books",
    "construcao_ferramentas_seguranca": "safety_tools",
    "industria_comercio_e_negocios": "industry_commerce",
    "fashion_underwear_e_moda_praia": "fashion_underwear_beach",
    "fashion_esporte": "fashion_sports",
    "agro_industria_e_comercio": "agro_industry",
}

# Shipping zone rates (DZD)
ZONE_SHIPPING_RATES = {
    "zone_1": 400,
    "zone_2": 600,
    "zone_3": 900,
}

# BRL to DZD approximate conversion rate
BRL_TO_DZD = 27.0
