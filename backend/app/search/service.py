from typing import List, Dict, Any, Optional
from app.meilisearch_client import get_meilisearch_client

INDEX_PRODUCTS = "products"
INDEX_ARTICLES = "articles"

def setup_search_indexes():
    client = get_meilisearch_client()
    try:
        # Create products index with French settings
        client.create_index(INDEX_PRODUCTS, {"primaryKey": "id"})
        idx = client.index(INDEX_PRODUCTS)
        idx.update_filterable_attributes(["category", "status", "price_cents"])
        idx.update_searchable_attributes(["name", "description", "brand"])

        # Create articles index
        client.create_index(INDEX_ARTICLES, {"primaryKey": "id"})
        art_idx = client.index(INDEX_ARTICLES)
        art_idx.update_filterable_attributes(["cluster_id", "status"])
        art_idx.update_searchable_attributes(["title", "content"])
    except Exception as e:
        # Index might already exist or Meilisearch offline during local mock tests
        pass

def sync_product_to_search(product_data: Dict[str, Any]):
    try:
        client = get_meilisearch_client()
        idx = client.index(INDEX_PRODUCTS)
        idx.add_documents([product_data])
    except Exception:
        pass

def delete_product_from_search(product_id: str):
    try:
        client = get_meilisearch_client()
        idx = client.index(INDEX_PRODUCTS)
        idx.delete_document(product_id)
    except Exception:
        pass

def search_products(query: str, category: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
    try:
        client = get_meilisearch_client()
        idx = client.index(INDEX_PRODUCTS)
        filter_str = "status = 'published'"
        if category:
            filter_str += f" AND category = '{category}'"
        
        res = idx.search(query, {"limit": limit, "filter": filter_str})
        return res.get("hits", [])
    except Exception:
        return []
