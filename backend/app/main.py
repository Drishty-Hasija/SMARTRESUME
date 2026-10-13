"""FastAPI application entry point."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import jobs, match, overview, resumes
from app.config import get_settings
from app.database.session import SessionLocal, init_db
from app.services.nlp_resources import warm_up
from app.services.workflows import get_default_user
from app.utils.errors import AppError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("smartresume")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    with SessionLocal() as db:
        get_default_user(db)
    warm_up()  # load NLTK data + spaCy once so the first request is fast
    logger.info("SmartResume API ready")
    yield


app = FastAPI(title="SmartResume API", version="1.0.0", lifespan=lifespan,
              description="NLP-based resume analysis and job description matching.")

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


def _error(status: int, code: str, message: str, hint: str | None = None, details=None) -> JSONResponse:
    body = {"error": {"code": code, "message": message, "hint": hint}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError):
    return _error(exc.status_code, exc.code, exc.message, exc.hint)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(p) for p in e["loc"][1:]) or "request", "message": e["msg"]}
               for e in exc.errors()]
    return _error(422, "invalid_request", "Some of the information you sent is invalid.",
                  "Check the highlighted fields and try again.", details)


@app.exception_handler(StarletteHTTPException)
async def http_handler(_: Request, exc: StarletteHTTPException):
    messages = {404: "We couldn't find what you were looking for.", 405: "This action isn't supported."}
    return _error(exc.status_code, "http_error", messages.get(exc.status_code, "The request couldn't be completed."))


@app.exception_handler(SQLAlchemyError)
async def db_handler(_: Request, exc: SQLAlchemyError):
    logger.exception("Database error: %s", exc)
    return _error(500, "database_error", "We couldn't save or load your data right now.", "Please try again.")


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return _error(500, "server_error", "Something went wrong on our side.", "Please try again in a moment.")


for r in (resumes.router, jobs.router, match.router, overview.router):
    app.include_router(r)
