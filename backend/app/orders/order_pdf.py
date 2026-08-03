"""Branded one page order confirmation.

Sent to the customer to confirm what was ordered and what they will pay the
courier. Generated server side with ReportLab rather than in the browser so the
output is identical whoever produces it, and so it can later be attached to an
email without a headless browser in the loop.

Layout follows start-point/inputs/references/factire_UI.png:

  1. Header        LUCEA lockup left, document title and order number right
  2. Welcome card  thank you note over a warm tinted panel
  3. Three cards   delivery, payment, status
  4. Two columns   the items table on the left, the next steps on the right
  5. Help strip    WhatsApp
  6. Signature row workshop details, founder signature, partner logo
  7. Disclaimer    this is a confirmation, not an invoice
"""

import os
from io import BytesIO
from typing import List, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas

# Brand palette, from start-point/inputs/04_Logo_Palette_Couleurs.md
CREAM = colors.HexColor("#FEF8F3")
SABLE_SOFT = colors.HexColor("#F3E9DA")
SABLE = colors.HexColor("#E8DCC8")
AMBRE = colors.HexColor("#D98E4A")
AMBRE_SOFT = colors.HexColor("#F6E7D3")
TERRACOTTA = colors.HexColor("#B75B39")
TERRA_DEEP = colors.HexColor("#A34E30")
INK = colors.HexColor("#1C1B19")
INK_SOFT = colors.HexColor("#3A3733")
PIERRE = colors.HexColor("#8C8578")
LINE = colors.HexColor("#E5DACA")
SUCCES = colors.HexColor("#3F7D52")
ALERTE = colors.HexColor("#B3452F")

PARTNER_NAME = "3D Print Maroc"
PARTNER_URL = "https://www.3dprintmaroc.com/"
FOUNDER = "Yassine Chouraichi"
FOUNDER_ROLE = "Fondateur & CEO"
WORKSHOP = "Atelier LUCEA, Casablanca, Maroc"
WHATSAPP = "06 00 00 00 00"

ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")
MARK = os.path.join(ASSETS, "lucea-mark.png")
# Full lockup as supplied: arch, LUCEA and the tagline in one asset
LOCKUP = os.path.join(ASSETS, "lucea-lockup.png")
SIGNATURE = os.path.join(ASSETS, "signature.png")
# The supplied partner mark has white wordmark text, so it is placed on the
# dark chip it was designed for rather than recoloured.
PARTNER_CHIP = os.path.join(ASSETS, "partner-logo-chip.png")
# Product photograph used inside the welcome card
HERO = os.path.join(ASSETS, "welcome-lamp.jpg")

STATUS_LABELS = {
    "pending": "En attente\nde confirmation",
    "confirmed": "Confirmée",
    "dispatched": "En cours\nde livraison",
    "delivered": "Livrée",
    "cancelled": "Annulée",
    "returned": "Retournée",
}
STATUS_COLORS = {
    "pending": AMBRE_SOFT,
    "confirmed": colors.HexColor("#E3ECF2"),
    "dispatched": SABLE,
    "delivered": colors.HexColor("#E4EFE6"),
    "cancelled": colors.HexColor("#F7E5E0"),
    "returned": colors.HexColor("#F7E5E0"),
}


def _register_fonts() -> Tuple[str, str]:
    """DejaVu when the image provides it, Helvetica otherwise.

    Customer names and addresses contain accents, which the built in Helvetica
    renders as empty boxes. Helvetica is always present, so the PDF can never
    fail to render because of a missing font.
    """
    regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if os.path.exists(regular) and os.path.exists(bold):
        try:
            pdfmetrics.registerFont(TTFont("Brand", regular))
            pdfmetrics.registerFont(TTFont("Brand-Bold", bold))
            return "Brand", "Brand-Bold"
        except Exception:
            pass
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = _register_fonts()


def _mad(cents: int) -> str:
    return f"{cents / 100:,.2f} MAD".replace(",", " ")


def _image(c, path: str, x: float, y: float, height: float) -> float:
    """Draws an image anchored at its bottom left, scaled to `height`.
    Returns the width used, or 0 when the asset is missing."""
    if not os.path.exists(path):
        return 0.0
    try:
        img = ImageReader(path)
        iw, ih = img.getSize()
        width = height * (iw / ih)
        c.drawImage(img, x, y, width=width, height=height,
                    mask="auto", preserveAspectRatio=True)
        return width
    except Exception:
        return 0.0


def _card(c, x: float, y: float, w: float, h: float,
          fill=colors.white, stroke=LINE, radius: float = 3 * mm) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def _wrap(c, text: str, font: str, size: float, max_width: float) -> List[str]:
    """Greedy word wrap measured against real string widths, so a wider font
    can never overflow a column."""
    words = (text or "").split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if c.stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def build_order_pdf(order, items: list) -> bytes:
    buffer = BytesIO()
    c = pdfcanvas.Canvas(buffer, pagesize=A4)
    W, H = A4
    M = 14 * mm
    right = W - M
    inner = right - M

    c.setTitle(f"Commande {order.order_number}, LUCEA Maroc")
    c.setAuthor("LUCEA Maroc")
    c.setSubject("Confirmation de commande")

    # Warm page wash, so the document reads as branded stationery
    c.setFillColor(CREAM)
    c.rect(0, 0, W, H, stroke=0, fill=1)

    # ---------------- 1. Header ----------------
    y = H - 14 * mm
    if not _image(c, LOCKUP, M, y - 20 * mm, 20 * mm):
        c.setFont(FONT_BOLD, 22)
        c.setFillColor(INK)
        c.drawString(M, y - 14 * mm, "LUCÉA")

    c.setFont(FONT_BOLD, 15)
    c.setFillColor(INK)
    c.drawRightString(right, y - 4 * mm, "Confirmation de commande")

    num_w = c.stringWidth(order.order_number, FONT_BOLD, 11.5) + 12 * mm
    c.setFillColor(AMBRE_SOFT)
    c.roundRect(right - num_w, y - 14.5 * mm, num_w, 8.5 * mm, 4 * mm, stroke=0, fill=1)
    c.setFont(FONT_BOLD, 11.5)
    c.setFillColor(TERRA_DEEP)
    c.drawCentredString(right - num_w / 2, y - 12 * mm, order.order_number)

    c.setFont(FONT, 8)
    c.setFillColor(PIERRE)
    placed = order.created_at.strftime("%d/%m/%Y à %H:%M") if order.created_at else ""
    c.drawRightString(right, y - 19.5 * mm, f"Passée le {placed}")

    y -= 26 * mm

    # ---------------- 2. Welcome card ----------------
    card_h = 25 * mm
    _card(c, M, y - card_h, inner, card_h, fill=SABLE_SOFT)
    _image(c, MARK, M + 6 * mm, y - card_h + 6 * mm, 13 * mm)

    # Product photograph on the right of the card, clipped to the rounded
    # corner so it reads as part of the panel rather than pasted on top.
    if os.path.exists(HERO):
        c.saveState()
        pth = c.beginPath()
        pth.roundRect(M, y - card_h, inner, card_h, 3 * mm)
        c.clipPath(pth, stroke=0, fill=0)
        try:
            img = ImageReader(HERO)
            iw, ih = img.getSize()
            ph = card_h
            pw = ph * (iw / ih)
            c.drawImage(img, right - pw, y - card_h, width=pw, height=ph,
                        mask="auto", preserveAspectRatio=True)
            # Fade the photo into the panel so the copy stays readable
            for i in range(26):
                c.setFillColor(SABLE_SOFT)
                c.setFillAlpha(1 - i / 25)
                c.rect(right - pw + i * (pw * 0.55 / 26), y - card_h,
                       pw * 0.55 / 26 + 0.6, card_h, stroke=0, fill=1)
            c.setFillAlpha(1)
        except Exception:
            pass
        c.restoreState()

    tx = M + 25 * mm
    c.setFont(FONT_BOLD, 11)
    c.setFillColor(INK)
    first_name = (order.name or "").strip().split(" ")[0]
    c.drawString(tx, y - 8.5 * mm, f"Merci pour votre commande, {first_name}.")

    c.setFont(FONT, 8.5)
    c.setFillColor(INK_SOFT)
    for i, line in enumerate([
        "Votre lampe est désormais dans la file de notre atelier à Casablanca.",
        "Ce document récapitule votre commande, conservez le comme référence.",
    ]):
        c.drawString(tx, y - 14.5 * mm - i * 4.6 * mm, line)

    y -= card_h + 5 * mm

    # ---------------- 3. Three cards ----------------
    gap = 4 * mm
    cw = (inner - gap * 2) / 3
    ch = 29 * mm
    top = y

    # Delivery
    _card(c, M, top - ch, cw, ch)
    c.setFont(FONT_BOLD, 8)
    c.setFillColor(TERRACOTTA)
    c.drawString(M + 5 * mm, top - 7 * mm, "LIVRAISON")
    c.setFont(FONT_BOLD, 9)
    c.setFillColor(INK)
    for i, line in enumerate(_wrap(c, order.name or "", FONT_BOLD, 9, cw - 10 * mm)[:1]):
        c.drawString(M + 5 * mm, top - 13.5 * mm, line)
    c.setFont(FONT, 8.5)
    c.setFillColor(INK_SOFT)
    c.drawString(M + 5 * mm, top - 18.5 * mm, order.phone or "")
    addr = _wrap(c, f"{order.address_line or ''}, {order.city or ''}", FONT, 7.5, cw - 10 * mm)
    for i, line in enumerate(addr[:2]):
        c.drawString(M + 5 * mm, top - 23 * mm - i * 3.8 * mm, line)

    # Payment
    px = M + cw + gap
    _card(c, px, top - ch, cw, ch)
    c.setFont(FONT_BOLD, 8)
    c.setFillColor(TERRACOTTA)
    c.drawString(px + 5 * mm, top - 7 * mm, "PAIEMENT À LA LIVRAISON")
    c.setFont(FONT, 7.5)
    c.setFillColor(INK_SOFT)
    c.drawString(px + 5 * mm, top - 12.5 * mm, "À régler en espèces au livreur")
    c.drawString(px + 5 * mm, top - 16.5 * mm, "après vérification du colis")

    total_txt = _mad(order.total_cents)
    tw = c.stringWidth(total_txt, FONT_BOLD, 13) + 9 * mm
    c.setFillColor(AMBRE_SOFT)
    c.roundRect(px + 5 * mm, top - 26 * mm, tw, 8 * mm, 2.5 * mm, stroke=0, fill=1)
    c.setFont(FONT_BOLD, 13)
    c.setFillColor(TERRA_DEEP)
    c.drawCentredString(px + 5 * mm + tw / 2, top - 23.6 * mm, total_txt)

    # Status
    sx = M + (cw + gap) * 2
    _card(c, sx, top - ch, cw, ch)
    c.setFont(FONT_BOLD, 8)
    c.setFillColor(TERRACOTTA)
    c.drawString(sx + 5 * mm, top - 7 * mm, "STATUT")

    lines = STATUS_LABELS.get(order.status, order.status).split("\n")
    pill_h = 6 * mm + len(lines) * 4.6 * mm
    c.setFillColor(STATUS_COLORS.get(order.status, SABLE))
    c.roundRect(sx + 5 * mm, top - 12 * mm - pill_h, cw - 10 * mm, pill_h, 2.5 * mm,
                stroke=0, fill=1)
    c.setFont(FONT_BOLD, 9)
    c.setFillColor(ALERTE if order.status in ("cancelled", "returned") else TERRA_DEEP)
    for i, line in enumerate(lines):
        c.drawCentredString(sx + cw / 2, top - 17.5 * mm - i * 4.6 * mm, line)

    y = top - ch - 5 * mm

    # ---------------- 4. Items and next steps ----------------
    left_w = inner * 0.62
    right_w = inner - left_w - gap
    rx = M + left_w + gap

    steps = [
        "Nous vous appelons dans l heure pour confirmer la gravure et le créneau.",
        "Fabrication en 48 heures, chaque lampe est allumée 4 heures avant emballage.",
        "Livraison en 24h à Casablanca et Rabat, 48 à 72h ailleurs au Maroc.",
        "Vous ouvrez le colis devant le livreur, puis vous réglez en espèces.",
    ]
    step_lines = [_wrap(c, s, FONT, 7.5, right_w - 18 * mm) for s in steps]

    # Two name lines is the cap, plus the optional engraving note
    rows_h = sum((8 * mm) + (4.5 * mm if i.config_text else 0) + 4.5 * mm for i in items)
    totals_rows = 2 + (1 if order.discount_cents else 0)
    left_h = 21 * mm + rows_h + totals_rows * 5.5 * mm + 13 * mm
    right_h = 15 * mm + sum(len(l) * 4 * mm + 4.5 * mm for l in step_lines)

    # Space reserved below the block: help strip, signature row and disclaimer
    HELP_H = 16 * mm
    SIGNATURE_H = 34 * mm
    DISCLAIMER_TOP = 19 * mm
    reserved = HELP_H + 5 * mm + SIGNATURE_H + 6 * mm + DISCLAIMER_TOP

    # Grow the block into whatever is left so the page never ends with a void
    available = y - reserved
    block_h = max(left_h, right_h, available)

    # ---- left: items ----
    _card(c, M, y - block_h, left_w, block_h)
    c.setFont(FONT_BOLD, 8.5)
    c.setFillColor(TERRACOTTA)
    c.drawString(M + 5 * mm, y - 8 * mm, "VOTRE COMMANDE")

    hy = y - 15 * mm
    c.setFont(FONT_BOLD, 7)
    c.setFillColor(PIERRE)
    c.drawString(M + 5 * mm, hy, "Article")
    c.drawCentredString(M + left_w - 52 * mm, hy, "Qté")
    c.drawRightString(M + left_w - 30 * mm, hy, "Prix")
    c.drawRightString(M + left_w - 5 * mm, hy, "Total")
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(M + 5 * mm, hy - 2.5 * mm, M + left_w - 5 * mm, hy - 2.5 * mm)

    iy = hy - 9 * mm
    for item in items:
        name_lines = _wrap(c, item.snapshotted_product_name or "", FONT, 8, left_w - 68 * mm)[:2]
        c.setFont(FONT, 8)
        c.setFillColor(INK)
        for i, line in enumerate(name_lines):
            c.drawString(M + 5 * mm, iy - i * 4 * mm, line)

        if item.config_text:
            c.setFont(FONT, 7)
            c.setFillColor(TERRA_DEEP)
            c.drawString(M + 5 * mm, iy - len(name_lines) * 4 * mm, f"Gravé : {item.config_text}")

        c.setFont(FONT, 8)
        c.setFillColor(INK_SOFT)
        c.drawCentredString(M + left_w - 52 * mm, iy, str(item.quantity))
        c.drawRightString(M + left_w - 30 * mm, iy, _mad(item.snapshotted_price_cents))
        c.setFont(FONT_BOLD, 8)
        c.setFillColor(INK)
        c.drawRightString(M + left_w - 5 * mm, iy, _mad(item.snapshotted_price_cents * item.quantity))

        # Row height follows the content: two name lines and an engraving note
        # each need their own space or the divider cuts through the text.
        used = len(name_lines) * 4 * mm + (4.5 * mm if item.config_text else 0)
        iy -= used + 4.5 * mm
        c.setStrokeColor(LINE)
        c.line(M + 5 * mm, iy + 3 * mm, M + left_w - 5 * mm, iy + 3 * mm)

    # Totals sit at the foot of the card, so extra height opens up between the
    # line items and the totals rather than below everything.
    totals_block_h = totals_rows * 5.5 * mm + 13 * mm
    iy = min(iy - 2 * mm, y - block_h + totals_block_h)

    rows = [("Sous total", order.subtotal_cents, INK_SOFT)]
    if order.discount_cents:
        rows.append(("Remise", -order.discount_cents, ALERTE))
    rows.append((
        "Livraison offerte" if not order.delivery_charge_cents else "Livraison",
        order.delivery_charge_cents,
        SUCCES if not order.delivery_charge_cents else INK_SOFT,
    ))

    for label, value, colour in rows:
        c.setFont(FONT, 8.5)
        c.setFillColor(colour)
        c.drawString(M + 5 * mm, iy, label)
        text = "Offerte" if value == 0 else (f"-{_mad(abs(value))}" if value < 0 else _mad(value))
        c.drawRightString(M + left_w - 5 * mm, iy, text)
        iy -= 5.5 * mm

    iy -= 1.5 * mm
    c.setStrokeColor(LINE)
    c.line(M + 5 * mm, iy + 3.5 * mm, M + left_w - 5 * mm, iy + 3.5 * mm)
    c.setFont(FONT_BOLD, 10.5)
    c.setFillColor(TERRA_DEEP)
    c.drawString(M + 5 * mm, iy - 3 * mm, "TOTAL À PAYER")
    c.setFont(FONT_BOLD, 12.5)
    c.setFillColor(INK)
    c.drawRightString(M + left_w - 5 * mm, iy - 3 * mm, _mad(order.total_cents))

    # ---- right: next steps ----
    _card(c, rx, y - block_h, right_w, block_h, fill=SABLE_SOFT)
    c.setFont(FONT_BOLD, 8.5)
    c.setFillColor(TERRACOTTA)
    c.drawString(rx + 5 * mm, y - 8 * mm, "LA SUITE")

    sy = y - 16 * mm
    for index, lines in enumerate(step_lines, start=1):
        c.setFillColor(AMBRE)
        c.circle(rx + 8.5 * mm, sy + 1 * mm, 2.6 * mm, stroke=0, fill=1)
        c.setFont(FONT_BOLD, 7)
        c.setFillColor(colors.white)
        c.drawCentredString(rx + 8.5 * mm, sy - 0.6 * mm, str(index))

        c.setFont(FONT, 7.5)
        c.setFillColor(INK_SOFT)
        for i, line in enumerate(lines):
            c.drawString(rx + 13.5 * mm, sy - i * 4 * mm, line)
        sy -= len(lines) * 4 * mm + 4.5 * mm

    y -= block_h + 5 * mm

    # ---------------- 5. Help strip ----------------
    help_h = HELP_H
    _card(c, M, y - help_h, inner, help_h)
    c.setFillColor(SUCCES)
    c.circle(M + 9 * mm, y - help_h / 2, 3.4 * mm, stroke=0, fill=1)
    c.setFont(FONT_BOLD, 7.5)
    c.setFillColor(colors.white)
    c.drawCentredString(M + 9 * mm, y - help_h / 2 - 1.1 * mm, "W")

    c.setFont(FONT_BOLD, 8.5)
    c.setFillColor(INK)
    c.drawString(M + 16 * mm, y - 6 * mm, "Une question sur cette commande ?")
    c.setFont(FONT, 7.5)
    c.setFillColor(INK_SOFT)
    c.drawString(M + 16 * mm, y - 10.5 * mm,
                 f"Écrivez nous sur WhatsApp au {WHATSAPP}, du lundi au samedi.")
    c.drawString(M + 16 * mm, y - 14 * mm,
                 "Indiquez votre numéro de commande, nous répondons en général dans l heure.")

    y -= help_h + 7 * mm

    # ---------------- 6. Signature row ----------------
    col = inner / 3

    c.setFont(FONT_BOLD, 9)
    c.setFillColor(TERRA_DEEP)
    c.drawString(M, y - 4 * mm, "LUCÉA MAROC")
    c.setFont(FONT, 7)
    c.setFillColor(INK_SOFT)
    for i, line in enumerate([
        "Atelier marocain de lampes et veilleuses",
        "imprimées en 3D. Nous gravons le prénom",
        "de votre choix et nous expédions partout.",
    ]):
        c.drawString(M, y - 9 * mm - i * 3.6 * mm, line)
    c.setFillColor(PIERRE)
    c.drawString(M, y - 23 * mm, f"WhatsApp {WHATSAPP}")
    c.drawString(M, y - 26.6 * mm, WORKSHOP)

    # Founder signature, from the supplied file
    sig_x = M + col
    c.setFont(FONT, 7)
    c.setFillColor(PIERRE)
    c.drawCentredString(sig_x + col / 2, y - 4 * mm, "SIGNATURE DU FONDATEUR")
    sig_h = 14 * mm
    if os.path.exists(SIGNATURE):
        img = ImageReader(SIGNATURE)
        iw, ih = img.getSize()
        sw = sig_h * (iw / ih)
        c.drawImage(img, sig_x + col / 2 - sw / 2, y - 21 * mm, width=sw, height=sig_h,
                    mask="auto", preserveAspectRatio=True)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(sig_x + 10 * mm, y - 23 * mm, sig_x + col - 10 * mm, y - 23 * mm)
    c.setFont(FONT_BOLD, 8)
    c.setFillColor(INK)
    c.drawCentredString(sig_x + col / 2, y - 27 * mm, FOUNDER)
    c.setFont(FONT, 7)
    c.setFillColor(PIERRE)
    c.drawCentredString(sig_x + col / 2, y - 30.6 * mm, FOUNDER_ROLE)

    # Partner
    pxc = M + col * 2
    c.setFont(FONT, 7)
    c.setFillColor(PIERRE)
    c.drawCentredString(pxc + col / 2, y - 4 * mm, "En collaboration avec")
    chip_h = 14 * mm
    if os.path.exists(PARTNER_CHIP):
        img = ImageReader(PARTNER_CHIP)
        iw, ih = img.getSize()
        chip_w = min(chip_h * (iw / ih), col - 6 * mm)
        chip_h_fit = chip_w / (iw / ih)
        c.drawImage(img, pxc + col / 2 - chip_w / 2, y - 8 * mm - chip_h_fit,
                    width=chip_w, height=chip_h_fit, mask="auto", preserveAspectRatio=True)
    else:
        c.setFont(FONT_BOLD, 9)
        c.setFillColor(INK)
        c.drawCentredString(pxc + col / 2, y - 14 * mm, PARTNER_NAME)

    c.setFont(FONT, 7)
    c.setFillColor(TERRA_DEEP)
    c.drawCentredString(pxc + col / 2, y - 27 * mm, PARTNER_URL)
    c.linkURL(PARTNER_URL, (pxc, y - 29 * mm, pxc + col, y - 2 * mm),
              relative=0, thickness=0)

    # ---------------- 7. Disclaimer ----------------
    strip_h = 9 * mm
    _card(c, M, 10 * mm, inner, strip_h, fill=AMBRE_SOFT, stroke=AMBRE_SOFT, radius=2 * mm)
    c.setFont(FONT, 7.5)
    c.setFillColor(TERRA_DEEP)
    c.drawCentredString(W / 2, 13 * mm,
                        "Ce document confirme votre commande. Il ne constitue pas une facture.")

    c.showPage()
    c.save()
    return buffer.getvalue()
