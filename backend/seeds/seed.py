"""Idempotent seed for the LUCEA store.

Creates roles, the default admin, the category tree, the four product lines,
the guide articles, the launch vouchers and the shipping zones. Running it
twice is safe: every block checks for an existing row first.

    docker compose exec api python -m seeds.seed
"""

import asyncio

from sqlalchemy.future import select

from app.database import AsyncSessionLocal, engine, Base
from app.auth.models import Role, StaffUser
from app.auth.service import hash_password
from app.catalog.models import Category, Product, Variant, ProductImage, StockMovement
from app.commerce.models import Voucher, ShippingZone
from app.content.models import Article, KeywordOwnership

UNSPLASH = "https://images.unsplash.com"

# Supplied brand photography, served from the app's own public folder. Random
# stock images made the catalogue look assembled from three different shops.
PHOTOS = {
    "veilleuse": "/images/collections/veilleuses.webp",
    "chevet": "/images/collections/chevet.webp",
    "salon": "/images/collections/salon.webp",
    "bureau": "/images/collections/bureau.webp",
}

CATEGORIES = [
    {"slug": "veilleuses-personnalisees", "name": "Veilleuses personnalisees"},
    {"slug": "lampes-chevet", "name": "Lampes de chevet"},
    {"slug": "lampes-salon", "name": "Lampes de salon"},
    {"slug": "lampes-bureau", "name": "Lampes de bureau"},
    {"slug": "luminaires-professionnels", "name": "Luminaires professionnels"},
]

PRODUCTS = [
    {
        "slug": "nura-veilleuse-prenom",
        "name": "NURA Veilleuse prenom personnalisee",
        "brand": "LUCEA",
        "categories": ["veilleuses-personnalisees"],
        "description": (
            "Veilleuse bebe gravee au prenom de votre enfant, imprimee en 3D dans notre atelier "
            "de Casablanca. La lumiere LED chaude de 2700 kelvins reste douce toute la nuit et "
            "n'agresse jamais les yeux au reveil. Le corps est imprime en PLA vegetal issu "
            "d'amidon de mais, sans plastique ABS ni solvant. Chaque piece est allumee pendant "
            "quatre heures et controlee avant emballage. Comptez 48 heures de fabrication pour "
            "la gravure du prenom, puis 24 heures de livraison sur Casablanca et Rabat."
        ),
        "images": [
            {"url": PHOTOS["veilleuse"],
             "alt": "Veilleuse NURA gravee au prenom posee sur une table de chevet"},
        ],
        "variants": [
            {"sku": "NURA-20", "price_cents": 29900, "stock": 24, "size_attribute": "20 cm"},
            {"sku": "NURA-30", "price_cents": 39900, "stock": 16, "size_attribute": "30 cm"},
        ],
    },
    {
        "slug": "velour-duo-chevet",
        "name": "VELOUR Duo de lampes de chevet",
        "brand": "LUCEA",
        "categories": ["lampes-chevet"],
        "description": (
            "Paire de lampes de chevet assorties, pensee pour une chambre parentale ou une "
            "chambre d'amis. Le diffuseur cannele adoucit la lumiere et projette un halo tres "
            "doux sur le mur, ideal pour lire au lit sans reveiller la personne a cote. "
            "Livrees avec deux ampoules LED 2700 kelvins et deux cables textile de 1,5 metre "
            "avec interrupteur a molette. Les deux lampes sont vendues ensemble."
        ),
        "images": [
            {"url": PHOTOS["chevet"],
             "alt": "Duo de lampes de chevet VELOUR allumees dans une chambre"},
        ],
        "variants": [
            {"sku": "VELOUR-DUO-24", "price_cents": 54900, "stock": 12, "size_attribute": "Duo 24 cm"},
        ],
    },
    {
        "slug": "selune-lampe-salon-zellige",
        "name": "SELUNE Lampe de salon motif zellige",
        "brand": "LUCEA",
        "categories": ["lampes-salon"],
        "description": (
            "Lampe d'ambiance de salon dont l'abat jour reprend la geometrie du zellige "
            "marocain. Une fois allumee, elle dessine un motif de lumiere sur les murs et le "
            "plafond, ce qui remplace avantageusement un plafonnier trop cru en soiree. "
            "Structure en PLA mat, socle leste, cable textile tresse de 2 metres. "
            "Compatible avec toute ampoule E27 jusqu'a 12 watts."
        ),
        "images": [
            {"url": PHOTOS["salon"],
             "alt": "Lampe de salon SELUNE au motif zellige posee sur une console"},
        ],
        "variants": [
            {"sku": "SELUNE-35", "price_cents": 44900, "stock": 18, "size_attribute": "35 cm"},
            {"sku": "SELUNE-50", "price_cents": 62900, "stock": 7, "size_attribute": "50 cm"},
        ],
    },
    {
        "slug": "calypsa-lampe-bureau",
        "name": "CALYPSA Lampe de bureau orientable",
        "brand": "LUCEA",
        "categories": ["lampes-bureau"],
        "description": (
            "Lampe de bureau a bras orientable concue pour le teletravail. Le diffuseur large "
            "eclaire le plan de travail sans renvoyer de reflet dans l'ecran, un probleme "
            "frequent avec les lampes de bureau bon marche. Trois temperatures de lumiere au "
            "choix, de 2700 a 5000 kelvins, et une intensite reglable en continu. "
            "Alimentation USB C, consommation maximale de 7 watts."
        ),
        "images": [
            {"url": PHOTOS["bureau"],
             "alt": "Lampe de bureau CALYPSA orientable posee sur un bureau en bois"},
        ],
        "variants": [
            {"sku": "CALYPSA-USB", "price_cents": 34900, "stock": 21, "size_attribute": "Bras 45 cm"},
        ],
    },
    {
        "slug": "nura-lampe-sans-fil-restaurant",
        "name": "NURA Lampe de table sans fil pour restaurant",
        "brand": "LUCEA",
        "categories": ["luminaires-professionnels"],
        "description": (
            "Lampe de table rechargeable pensee pour les cafes, les restaurants et les "
            "terrasses d'hotel. Une charge complete tient 18 heures en intensite moyenne, ce "
            "qui couvre deux services sans manipulation. Base lestee stable, coque lavable, "
            "gravure de votre logo possible a partir de dix pieces. Tarif degressif et facture "
            "avec TVA fournie pour toute commande professionnelle."
        ),
        "images": [
            {"url": PHOTOS["salon"],
             "alt": "Lampe sans fil NURA posee sur une table de restaurant"},
        ],
        "variants": [
            {"sku": "NURA-PRO-18", "price_cents": 39900, "stock": 40, "size_attribute": "18 cm rechargeable"},
        ],
    },
    {
        "slug": "velour-coffret-cadeau-naissance",
        "name": "VELOUR Coffret cadeau naissance",
        "brand": "LUCEA",
        "categories": ["veilleuses-personnalisees"],
        "description": (
            "Coffret cadeau pret a offrir contenant une veilleuse gravee au prenom, une carte "
            "manuscrite a votre message et un emballage kraft ferme d'un ruban. Nous expedions "
            "directement chez la personne a qui le cadeau est destine si vous le souhaitez, "
            "sans facture visible dans le colis. Le prenom se saisit au moment de l'ajout au "
            "panier, quinze caracteres au maximum."
        ),
        "images": [
            {"url": PHOTOS["veilleuse"],
             "alt": "Coffret cadeau naissance VELOUR avec veilleuse gravee"},
        ],
        "variants": [
            {"sku": "VELOUR-GIFT-20", "price_cents": 36900, "stock": 15, "size_attribute": "Coffret 20 cm"},
        ],
    },
]

ARTICLES = [
    {
        "slug": "guide-choisir-veilleuse-bebe-maroc",
        "title": "Comment choisir une veilleuse bebe au Maroc",
        "cluster_id": "lampe-personnalisee-cadeau",
        "status": "published",
        "content": (
            "Une bonne veilleuse bebe se juge sur trois criteres: la temperature de la lumiere, "
            "la matiere de la coque et la stabilite de l'objet.\n\n"
            "### La temperature de lumiere\n"
            "Visez 2700 kelvins. Au dela de 4000 kelvins la lumiere devient bleutee et retarde "
            "la production de melatonine, donc l'endormissement. Une veilleuse qui parait "
            "blanche ou bleutee dans son emballage sera trop froide pour une chambre d'enfant.\n\n"
            "### La matiere\n"
            "Le PLA est un plastique vegetal issu de l'amidon de mais. Il ne degage pas de "
            "styrene en chauffant, contrairement a l'ABS utilise dans beaucoup de veilleuses "
            "importees. Demandez systematiquement la matiere avant d'acheter.\n\n"
            "### La stabilite\n"
            "Un socle leste evite que la lampe bascule quand l'enfant grandit et attrape tout "
            "ce qui depasse de la table de chevet. Verifiez aussi que le cable fait au moins "
            "1,5 metre pour eviter les rallonges au sol.\n\n"
            "### Le prenom grave\n"
            "La gravure du prenom transforme un objet utilitaire en souvenir de chambre. "
            "Comptez 48 heures de fabrication supplementaires pour une piece personnalisee, "
            "ce qui reste compatible avec un cadeau de naissance prepare une semaine a l'avance."
        ),
    },
    {
        "slug": "duo-lampes-chevet-astuces-chambre",
        "title": "Cinq facons d'eclairer une chambre avec un duo de chevet",
        "cluster_id": "lampe-chevet-chambre",
        "status": "published",
        "content": (
            "Un plafonnier unique ecrase les volumes et fatigue les yeux le soir. Deux lampes "
            "de chevet identiques reglent le probleme pour un budget modeste.\n\n"
            "### Placez les lampes a hauteur d'epaule assise\n"
            "Le bas de l'abat jour doit arriver au niveau de votre epaule quand vous etes assis "
            "dans le lit. Plus haut, l'ampoule eblouit. Plus bas, vous n'avez pas assez de "
            "lumiere pour lire.\n\n"
            "### Gardez la meme temperature partout\n"
            "Melanger une ampoule 2700 kelvins et une ampoule 4000 kelvins dans la meme piece "
            "donne une impression de desordre visuel meme quand on ne sait pas l'expliquer.\n\n"
            "### Preferez un interrupteur sur le cable\n"
            "Pouvoir eteindre sans se lever change l'usage quotidien de la lampe bien plus que "
            "n'importe quel detail esthetique.\n\n"
            "### Doublez la lumiere plutot que de l'augmenter\n"
            "Deux sources de 6 watts eclairent mieux et plus agreablement qu'une seule de 12 "
            "watts, parce que les ombres se compensent.\n\n"
            "### Pensez a la prise\n"
            "Mesurez la distance entre la prise et la table de chevet avant de commander. "
            "Nos cables textiles font 1,5 metre."
        ),
    },
    {
        "slug": "eclairage-bureau-teletravail-sans-reflet",
        "title": "Eclairer un bureau de teletravail sans reflet sur l'ecran",
        "cluster_id": "lampe-bureau-teletravail",
        "status": "published",
        "content": (
            "Le reflet sur l'ecran vient presque toujours d'une source lumineuse placee face a "
            "l'ecran ou juste derriere vous.\n\n"
            "### Eclairez le plan de travail, pas l'ecran\n"
            "Placez la lampe sur le cote, legerement en avant du bord de l'ecran, orientee vers "
            "le clavier et les documents. L'ecran produit deja sa propre lumiere.\n\n"
            "### Choisissez un diffuseur large\n"
            "Une petite ampoule nue cree un point brillant qui se reflete. Un diffuseur large "
            "repartit la meme quantite de lumiere sans point chaud.\n\n"
            "### Adaptez la temperature a l'heure\n"
            "5000 kelvins le matin pour la concentration, 2700 kelvins en fin de journee pour "
            "ne pas retarder le sommeil. Une lampe a temperature reglable evite d'en acheter deux.\n\n"
            "### Evitez le contre jour\n"
            "Une fenetre derriere l'ecran oblige l'oeil a compenser en permanence entre deux "
            "niveaux de luminosite. Tournez le bureau d'un quart de tour si vous le pouvez."
        ),
    },
    {
        "slug": "lampe-3d-vs-lampe-importee-comparatif",
        "title": "Lampe imprimee en 3D ou lampe importee, le comparatif",
        "cluster_id": "lampe-salon-design",
        "status": "published",
        "content": (
            "Les deux categories se croisent sur le prix mais pas sur le reste.\n\n"
            "### Delai\n"
            "Une lampe importee est en stock ou ne l'est pas. Une lampe imprimee est fabriquee "
            "a la commande, ce qui ajoute 48 heures mais evite les ruptures.\n\n"
            "### Personnalisation\n"
            "Un prenom, une couleur, une taille intermediaire: possible en impression 3D, "
            "impossible sur un modele importe en conteneur.\n\n"
            "### Reparation\n"
            "Une piece cassee se reimprime a l'identique chez nous. Sur un modele importe, une "
            "piece cassee condamne generalement la lampe.\n\n"
            "### Matiere\n"
            "PLA vegetal contre ABS petrochimique. La difference se sent a l'odeur des la "
            "premiere heure d'allumage.\n\n"
            "### Service apres vente\n"
            "Un atelier local repond sur WhatsApp le jour meme. Un revendeur d'import renvoie "
            "vers un fabricant qui ne repond pas en francais."
        ),
    },
    {
        "slug": "luminaire-professionnel-cafe-hotel-maroc",
        "title": "Choisir un luminaire de table pour un cafe ou un hotel",
        "cluster_id": "pro-hotellerie-evenementiel",
        "status": "published",
        "content": (
            "Un luminaire de table professionnel se choisit sur l'autonomie et sur le cout de "
            "remplacement, pas sur le style seul.\n\n"
            "### Autonomie reelle\n"
            "Demandez l'autonomie en intensite moyenne, pas en intensite minimale. Une lampe "
            "annoncee a 40 heures tient souvent 15 heures en usage reel de salle.\n\n"
            "### Cout de remplacement\n"
            "Sur un parc de trente lampes, la casse annuelle tourne autour de dix pour cent. "
            "Une lampe reimprimable localement coute bien moins cher a maintenir qu'un modele "
            "importe a remplacer entierement.\n\n"
            "### Gravure du logo\n"
            "Nous gravons votre logo a partir de dix pieces, sans frais de moule.\n\n"
            "### Facturation\n"
            "Facture avec TVA fournie systematiquement, et devis sous 24 heures ouvrees pour "
            "toute demande de plus de dix pieces."
        ),
    },
]

VOUCHERS = [
    {"code": "BIENVENUE10", "discount_type": "percentage", "value": 10, "usage_limit": 1000},
    {"code": "LIVRAISON50", "discount_type": "fixed_cents", "value": 5000, "usage_limit": 500},
    {"code": "PRO15", "discount_type": "percentage", "value": 15, "usage_limit": 200},
]

SHIPPING_ZONES = [
    {
        "zone_name": "Zone 1",
        "cities_covered": ["Casablanca", "Bouskoura"],
        "delivery_time": "24 heures",
        "shipping_cost_cents": 2000,
        "free_threshold_cents": 35000,
        "default_carrier": "Coursier local",
    },
    {
        "zone_name": "Zone 2",
        "cities_covered": ["Rabat", "Sale", "Marrakech"],
        "delivery_time": "24 a 48 heures",
        "shipping_cost_cents": 3500,
        "free_threshold_cents": 35000,
        "default_carrier": "Transporteur national",
    },
    {
        "zone_name": "Zone 3",
        "cities_covered": ["Tanger", "Agadir", "Fes", "Meknes", "Oujda", "Autre ville"],
        "delivery_time": "48 a 72 heures",
        "shipping_cost_cents": 4500,
        "free_threshold_cents": 45000,
        "default_carrier": "Transporteur national",
    },
]

KEYWORDS = [
    ("veilleuse prenom bebe", "/lampe-personnalisee-cadeau", "money"),
    ("lampe de chevet maroc", "/lampe-chevet-chambre", "money"),
    ("lampe salon moderne maroc", "/lampe-salon-design", "money"),
    ("lampe de bureau maroc", "/lampe-bureau-teletravail", "money"),
    ("luminaire professionnel maroc", "/pro-hotellerie-evenementiel", "money"),
]


async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Roles
        for role_name in ("admin", "editor", "fulfillment", "viewer"):
            found = (await session.execute(select(Role).where(Role.name == role_name))).scalars().first()
            if not found:
                session.add(Role(name=role_name, description=f"{role_name.capitalize()} role"))
        await session.commit()

        # 2. Default admin
        admin_email = "admin@luceamaroc.com"
        found = (await session.execute(select(StaffUser).where(StaffUser.email == admin_email))).scalars().first()
        if not found:
            session.add(StaffUser(
                username="admin",
                email=admin_email,
                password_hash=hash_password("AdminSecurePassword123!"),
                role_name="admin",
                is_active=True,
            ))
            await session.commit()
            print(f"admin user created: {admin_email}")

        # 3. Categories
        category_by_slug = {}
        for cat in CATEGORIES:
            found = (await session.execute(select(Category).where(Category.slug == cat["slug"]))).scalars().first()
            if not found:
                found = Category(slug=cat["slug"], name=cat["name"])
                session.add(found)
                await session.flush()
            category_by_slug[cat["slug"]] = found
        await session.commit()

        # 4. Products with variants and images
        created_products = 0
        for spec in PRODUCTS:
            found = (await session.execute(select(Product).where(Product.slug == spec["slug"]))).scalars().first()
            if found:
                continue

            product = Product(
                name=spec["name"],
                slug=spec["slug"],
                description=spec["description"],
                brand=spec["brand"],
                status="published",
            )
            product.categories = [category_by_slug[s] for s in spec["categories"] if s in category_by_slug]

            for position, img in enumerate(spec["images"]):
                product.images.append(ProductImage(url=img["url"], alt=img["alt"], position=position))

            for var in spec["variants"]:
                product.variants.append(Variant(
                    sku=var["sku"],
                    price_cents=var["price_cents"],
                    stock=var["stock"],
                    size_attribute=var["size_attribute"],
                ))

            session.add(product)
            await session.flush()

            for variant in product.variants:
                session.add(StockMovement(variant_id=variant.id, delta=variant.stock, reason="initial_seed"))

            created_products += 1
        await session.commit()
        if created_products:
            print(f"products created: {created_products}")

        # 5. Articles
        created_articles = 0
        for spec in ARTICLES:
            found = (await session.execute(select(Article).where(Article.slug == spec["slug"]))).scalars().first()
            if not found:
                session.add(Article(**spec))
                created_articles += 1
        await session.commit()
        if created_articles:
            print(f"articles created: {created_articles}")

        # 6. Vouchers
        for spec in VOUCHERS:
            found = (await session.execute(select(Voucher).where(Voucher.code == spec["code"]))).scalars().first()
            if not found:
                session.add(Voucher(**spec, usage_count=0, active_status=True))
        await session.commit()

        # 7. Shipping zones
        for spec in SHIPPING_ZONES:
            found = (await session.execute(
                select(ShippingZone).where(ShippingZone.zone_name == spec["zone_name"])
            )).scalars().first()
            if not found:
                session.add(ShippingZone(**spec))
        await session.commit()

        # 8. Keyword ownership register
        for keyword, url, page_type in KEYWORDS:
            found = (await session.execute(
                select(KeywordOwnership).where(KeywordOwnership.keyword == keyword)
            )).scalars().first()
            if not found:
                session.add(KeywordOwnership(keyword=keyword, owning_url=url, page_type=page_type))
        await session.commit()

        print("seed complete")


if __name__ == "__main__":
    asyncio.run(seed_data())
