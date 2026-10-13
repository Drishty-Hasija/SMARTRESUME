from fastapi import Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.entities import User
from app.services.workflows import get_default_user


def current_user(db: Session = Depends(get_db)) -> User:
    return get_default_user(db)
