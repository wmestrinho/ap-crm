/**
 * AP Ops | Absolutely Plausible — Invoice PDF Generator
 * 100% client-side via jsPDF. No server required.
 * Works offline at the track.
 */

let lineItemCount = 0;

function addLineItem(desc = '', qty = 1, unit = '') {
  lineItemCount++;
  const id = lineItemCount;
  const list = document.getElementById('lineItemsList');

  const row = document.createElement('div');
  row.className = 'line-item';
  row.id = `li_${id}`;
  row.innerHTML = `
    <input type="text"   id="li_desc_${id}"  placeholder="Service or part description" value="${desc}" oninput="recalcLine(${id})" />
    <input type="number" id="li_qty_${id}"   value="${qty}"  min="1" step="1"    oninput="recalcLine(${id})" style="text-align:center" />
    <input type="number" id="li_unit_${id}"  value="${unit}" min="0" step="0.01" oninput="recalcLine(${id})" placeholder="0.00" />
    <div class="line-total" id="li_total_${id}">$0.00</div>
    <button class="remove-line" onclick="removeLine(${id})">✕</button>
  `;
  list.appendChild(row);
  recalcLine(id);
}

function removeLine(id) {
  document.getElementById(`li_${id}`)?.remove();
  recalcInvoiceTotals();
}

function recalcLine(id) {
  const qty  = parseFloat(document.getElementById(`li_qty_${id}`)?.value  || 0);
  const unit = parseFloat(document.getElementById(`li_unit_${id}`)?.value || 0);
  const total = qty * unit;
  const el = document.getElementById(`li_total_${id}`);
  if (el) el.textContent = `$${total.toFixed(2)}`;
  recalcInvoiceTotals();
}

function recalcInvoiceTotals() {
  let sub = 0;
  document.querySelectorAll('.line-item').forEach(row => {
    const id = row.id.replace('li_', '');
    const qty  = parseFloat(document.getElementById(`li_qty_${id}`)?.value  || 0);
    const unit = parseFloat(document.getElementById(`li_unit_${id}`)?.value || 0);
    sub += qty * unit;
  });
  document.getElementById('inv_subtotal').textContent = `$${sub.toFixed(2)}`;
  document.getElementById('inv_total').textContent    = `$${sub.toFixed(2)}`;
}

function getInvoiceData() {
  const items = [];
  document.querySelectorAll('.line-item').forEach(row => {
    const id   = row.id.replace('li_', '');
    const desc = document.getElementById(`li_desc_${id}`)?.value.trim() || '';
    const qty  = parseFloat(document.getElementById(`li_qty_${id}`)?.value  || 0);
    const unit = parseFloat(document.getElementById(`li_unit_${id}`)?.value || 0);
    if (desc || unit > 0) items.push({ desc, qty, unit, total: qty * unit });
  });

  const total = items.reduce((s, i) => s + i.total, 0);

  return {
    org:     document.getElementById('inv_org')?.value.trim()     || '',
    contact: document.getElementById('inv_contact')?.value.trim() || '',
    email:   document.getElementById('inv_email')?.value.trim()   || '',
    phone:   document.getElementById('inv_phone')?.value.trim()   || '',
    number:  document.getElementById('inv_number')?.value.trim()  || '',
    project: document.getElementById('inv_event')?.value.trim()   || STATE.currentProject || '',
    notes:   document.getElementById('inv_notes')?.value.trim()   || '',
    items,
    total,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    loggedBy: STATE.currentUser || 'AP',
  };
}

function generateInvoicePDF() {
  const d = getInvoiceData();

  if (!d.org) { toast('Bill-to organization is required', true); return; }
  if (!d.number) { toast('Invoice number is required', true); return; }
  if (d.items.length === 0) { toast('Add at least one line item', true); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const RED      = [192, 57, 43];
  const GRAPHITE = [61,  61, 61];
  const BLACK    = [15,  15, 15];
  const LGRAY    = [240, 240, 240];
  const WHITE    = [255, 255, 255];

  const W = doc.internal.pageSize.getWidth();
  const M = 48; // left margin

  // ── Header band ──
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 90, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('ABSOLUTELY PLAUSIBLE', M, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Operations & Invoicing', M, 52);
  doc.text(`${AP.business.phone}  |  ${AP.business.email}  |  ${AP.business.address}`, M, 64);
  doc.text(AP.business.instagram, M, 76);

  // INVOICE label (right side of header)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...WHITE);
  doc.text('INVOICE', W - M, 50, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${d.number}`, W - M, 66, { align: 'right' });

  // ── Gray sub-header band ──
  doc.setFillColor(...LGRAY);
  doc.rect(0, 90, W, 36, 'F');

  doc.setTextColor(...GRAPHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('DATE', M, 106);
  doc.text('PROJECT', 220, 106);
  doc.text('LOGGED BY', 440, 106);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(d.date, M, 118);
  doc.text(d.project || '—', 220, 118);
  doc.text(d.loggedBy, 440, 118);

  // ── Bill To ──
  let y = 152;
  doc.setTextColor(...GRAPHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('BILL TO', M, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  doc.text(d.org, M, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAPHITE);
  if (d.contact) { doc.text(d.contact, M, y); y += 12; }
  if (d.email)   { doc.text(d.email,   M, y); y += 12; }
  if (d.phone)   { doc.text(d.phone,   M, y); y += 12; }

  // ── Line items table ──
  y += 16;

  // Table header
  doc.setFillColor(...RED);
  doc.rect(M, y, W - M * 2, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  const COL = { desc: M + 6, qty: W - 230, unit: W - 160, total: W - 60 };
  doc.text('DESCRIPTION', COL.desc, y + 14);
  doc.text('QTY',  COL.qty,  y + 14, { align: 'center' });
  doc.text('UNIT', COL.unit, y + 14, { align: 'right' });
  doc.text('TOTAL', COL.total, y + 14, { align: 'right' });
  y += 22;

  // Rows
  d.items.forEach((item, idx) => {
    const rowH = 22;
    if (idx % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(M, y, W - M * 2, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text(item.desc, COL.desc, y + 14);
    doc.text(String(item.qty),                 COL.qty,   y + 14, { align: 'center' });
    doc.text(`$${item.unit.toFixed(2)}`,       COL.unit,  y + 14, { align: 'right' });
    doc.text(`$${item.total.toFixed(2)}`,      COL.total, y + 14, { align: 'right' });
    y += rowH;
  });

  // Divider
  doc.setDrawColor(...RED);
  doc.setLineWidth(1.5);
  doc.line(M, y + 4, W - M, y + 4);
  y += 18;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text('TOTAL', COL.unit, y + 2, { align: 'right' });
  doc.setTextColor(...RED);
  doc.setFontSize(15);
  doc.text(`$${d.total.toFixed(2)}`, COL.total, y + 2, { align: 'right' });
  y += 30;

  // ── Notes ──
  if (d.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GRAPHITE);
    doc.text('PAYMENT / NOTES', M, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    const lines = doc.splitTextToSize(d.notes, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 12 + 8;
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 36;
  doc.setFillColor(...GRAPHITE);
  doc.rect(0, footerY, W, 36, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text('Thank you for choosing Absolutely Plausible!', W / 2, footerY + 14, { align: 'center' });
  doc.text('AP Ops — Absolutely Plausible', W / 2, footerY + 26, { align: 'center' });

  // ── Save ──
  const filename = `AP_Invoice_${d.number}_${d.org.replace(/\s+/g,'_')}.pdf`;
  doc.save(filename);
  toast(`Invoice PDF saved: ${filename}`);
}

async function saveInvoiceToSheets() {
  const d = getInvoiceData();
  if (!d.org) { toast('Client required', true); return; }
  if (!d.number) { toast('Invoice number required', true); return; }
  try {
    await logInvoice(d);
    toast('Invoice saved to Sheets ✓');
  } catch (e) {
    toast('Saved locally — Sheets offline', false);
  }
  saveLocalEntry({
    type: 'invoice',
    client:  d.org,
    project: d.project,
    org:     d.org,
    amount:  d.total,
    loggedBy: d.loggedBy,
    invoiceNumber: d.number,
  });
  saveLocalClient(d.org);
  const invNum = document.getElementById('inv_number');
  if (invNum) invNum.value = generateInvoiceNumber();
}
