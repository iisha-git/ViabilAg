"""Optional server-side OCR via the tesseract program.

Off by default: the browser reads labels with tesseract.js, which needs no
install. This endpoint exists for clients that cannot run OCR themselves.
Enable: install the tesseract program, then `pip install pytesseract Pillow`.

Privacy: the uploaded image is read once for this request, never stored, never
logged, and discarded when the request ends. Honest detail: while the request is
handled, the web server's upload parser and the tesseract program can use
short-lived temporary system files (that is how they are built); those files are
deleted when the request ends. Nothing about the photo is kept afterwards.
"""
import io

from .. import config


class OcrUnavailable(RuntimeError):
    pass


def available() -> bool:
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
        import PIL  # noqa: F401
        return True
    except Exception:
        return False


def read_image(data: bytes) -> str:
    if not available():
        raise OcrUnavailable("Server OCR is not installed (needs the tesseract program + pytesseract + Pillow).")
    import pytesseract
    from PIL import Image
    # Reject decompression bombs: a tiny file that unpacks to a giant image.
    Image.MAX_IMAGE_PIXELS = config.OCR_MAX_PIXELS
    try:
        img = Image.open(io.BytesIO(data))
    except Image.DecompressionBombError:
        raise ValueError("That image is suspiciously large for its file size.")
    except Exception:
        raise ValueError("That file is not a readable image (use jpg or png).")
    # Hard pixel cap, checked BEFORE decoding: Pillow only warns between the cap
    # and twice the cap, so without this a >40 MP image would still be decoded.
    if img.width * img.height > config.OCR_MAX_PIXELS:
        img.close()
        raise ValueError(f"That image is too many pixels to read safely "
                         f"(max {config.OCR_MAX_PIXELS // 1_000_000} megapixels).")
    try:
        img.load()
    except Image.DecompressionBombError:
        img.close()
        raise ValueError("That image is suspiciously large for its file size.")
    except Exception:
        img.close()
        raise ValueError("That file is not a readable image (use jpg or png).")
    try:
        return pytesseract.image_to_string(img).strip()
    finally:
        img.close()
