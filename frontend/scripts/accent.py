import os

path = r"d:\3D Designs\lamp_store\src\lib\pageSeo.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ("Veilleuses prenom", "Veilleuses prénom"),
    ("gravees", "gravées"),
    ("au prenom", "au prénom"),
    ("imprimees", "imprimées"),
    ("24h a Casa", "24h à Casa"),
    ("paiement a la", "paiement à la"),
    ("vegetal", "végétal"),
    ("des luminaires", "des luminaires"),
    ("offerte des 350", "offerte dès 350"),
    ("a la reception", "à la réception"),
    ("bebe", "bébé"),
    ("eclairer", "éclairer"),
    ("rediges", "rédigés"),
    ("numero", "numéro"),
    ("telephone", "téléphone"),
    ("utilise a", "utilisé à"),
    ("l achat", "l'achat"),
    ("etapes", "étapes"),
    ("estimee", "estimée"),
    ("qualite", "qualité"),
    ("delais", "délais"),
    ("A propos", "À propos"),
    ("a Casablanca", "à Casablanca"),
    ("matieres", "matières"),
    ("expliques en detail", "expliqués en détail"),
    ("frequentes", "fréquentes"),
    ("Delais", "Délais"),
    ("reponses", "réponses"),
    ("especes", "espèces"),
    ("a la reception", "à la réception"),
    ("apres verification", "après vérification"),
    ("detailles", "détaillés"),
    ("Ecrivez nous", "Écrivez-nous"),
    ("repondons", "répondons"),
    ("meme du lundi", "même du lundi"),
    ("personnalisee", "personnalisée"),
    ("gravee", "gravée"),
    ("Lumiere", "Lumière"),
    ("lumiere", "lumière"),
    ("cable", "câble"),
    ("teletravail", "télétravail"),
    ("ecran", "écran"),
    ("temperatures", "températures"),
    ("intensite", "intensité"),
    ("reglable", "réglable"),
    ("cafes", "cafés"),
    ("hotels", "hôtels"),
    ("d autonomie", "d'autonomie"),
    ("des 10 pieces", "dès 10 pièces"),
    ("Decouvrez", "Découvrez"),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced!")
