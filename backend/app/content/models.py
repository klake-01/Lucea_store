import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Text, DateTime, Date, JSON
from app.database import Base

class Article(Base):
    """A blog article.

    The field set is the data contract in `00-foundation/05-BLOG-SYSTEM.md`
    part A.1, mapped onto this store rather than the spec's standalone
    `blog_posts` table. Two deliberate differences, both documented in that
    file's adaptation note:

      * `cluster_id` is kept and stays authoritative. It is this store's
        existing link from an article to the money page that owns its head
        keyword, and it is stronger than the spec's free text `category`,
        which is derived from it for display.
      * Arrays and objects use `JSON`, not Postgres `TEXT[]`/`JSONB`, because
        the test suite runs on SQLite and the rest of this codebase already
        stores structured columns that way.
    """

    __tablename__ = "articles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    cluster_id = Column(String, index=True, nullable=False) # e.g. 'lampe-personnalisee-cadeau'
    status = Column(String, default="draft", nullable=False) # draft, review, published

    # Banner shown at the top of the article and used as the social preview.
    # These are the spec's cover_image_url / cover_image_alt under this
    # store's existing names, so no data had to be moved.
    banner_url = Column(String, nullable=True)
    banner_alt = Column(String, nullable=True)
    banner_storage_key = Column(String, nullable=True)

    # Comma separated target keywords. The overlap check below reads these to
    # warn when two guides start competing for the same query.
    keywords = Column(String, nullable=True)
    excerpt = Column(String, nullable=True)

    # ---- spec part A.1 -------------------------------------------------
    target_keyword = Column(String, nullable=True)
    seo_title = Column(String, nullable=True)
    seo_meta_description = Column(String, nullable=True)
    seo_keywords = Column(JSON, nullable=True, default=list)      # ["a","b","c"]
    category = Column(String, nullable=True)                       # display label
    tags = Column(JSON, nullable=True, default=list)
    author = Column(String, nullable=True)
    content_images = Column(JSON, nullable=True, default=list)     # [{url,alt,title,caption}]
    faqs = Column(JSON, nullable=True, default=list)               # [{question,answer}]
    cta = Column(JSON, nullable=True)                              # {category,link,title,description}
    published_date = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Redirect(Base):
    __tablename__ = "redirects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    source_url = Column(String, unique=True, index=True, nullable=False)
    target_url = Column(String, nullable=False)
    status_code = Column(String, default="308", nullable=False) # 301 or 308

class KeywordOwnership(Base):
    __tablename__ = "keyword_ownership"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    keyword = Column(String, unique=True, index=True, nullable=False)
    owning_url = Column(String, nullable=False)
    page_type = Column(String, nullable=False) # money, hub, pdp, article
