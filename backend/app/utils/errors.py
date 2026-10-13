"""Application errors. Messages are written for end users, never raw tracebacks."""


class AppError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "bad_request", hint: str | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.hint = hint


class UnsupportedFileType(AppError):
    def __init__(self, ext: str = ""):
        super().__init__(
            f"Unsupported file type{f' (.{ext})' if ext else ''}.", 415, "unsupported_file_type",
            "Upload a PDF, DOCX or TXT file.")


class FileTooLarge(AppError):
    def __init__(self, max_mb: int):
        super().__init__(f"This file is larger than {max_mb} MB.", 413, "file_too_large",
                         "Try compressing the file or exporting a smaller version.")


class ExtractionFailed(AppError):
    def __init__(self, message: str = "We couldn't read this file.", hint: str | None = None):
        super().__init__(message, 422, "extraction_failed",
                         hint or "Try uploading a text-based PDF or DOCX file.")


class InsufficientText(AppError):
    def __init__(self, what: str = "resume"):
        super().__init__(
            f"This {what} contains too little text to analyse.", 422, "insufficient_text",
            "If it is a scanned image, export a text-based PDF or paste the text into a DOCX/TXT file.")


class NotFound(AppError):
    def __init__(self, what: str = "Item"):
        super().__init__(f"{what} not found.", 404, "not_found")
