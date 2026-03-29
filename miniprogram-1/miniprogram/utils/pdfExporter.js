const { formatDate, getTodayDate } = require('./date');

function escapePdfText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

function buildPdfText(lines) {
  const pageLines = (lines || []).slice(0, 42);
  const streamRows = ['BT', '/F1 11 Tf'];

  pageLines.forEach((line, index) => {
    const y = 800 - index * 18;
    streamRows.push(`1 0 0 1 40 ${y} Tm (${escapePdfText(line)}) Tj`);
  });

  streamRows.push('ET');
  const stream = streamRows.join('\n');

  const objects = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    4: `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    5: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  };

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (let i = 1; i <= 5; i += 1) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';

  for (let i = 1; i <= 5; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}

function buildReportLines(records) {
  const today = getTodayDate();
  const generatedAt = `${formatDate(new Date())} ${new Date().toTimeString().substring(0, 8)}`;
  const total = records.length;
  const typeCount = {};

  records.forEach((record) => {
    const type = Number(record.type || 0);
    if (!typeCount[type]) typeCount[type] = 0;
    typeCount[type] += 1;
  });

  const lines = [
    'Gut Diary Health Report',
    `Generated At: ${generatedAt}`,
    `Today: ${today}`,
    `Total Records: ${total}`,
    '',
    'Type Distribution:',
  ];

  for (let i = 1; i <= 7; i += 1) {
    lines.push(`Type ${i}: ${typeCount[i] || 0}`);
  }

  lines.push('');
  lines.push('Recent Records (latest 25):');

  const recent = records.slice(0, 25);
  recent.forEach((item, index) => {
    const feelings = (item.feelings || []).join('|') || '-';
    const note = (item.note || '-').slice(0, 24);
    lines.push(
      `${index + 1}. ${item.date} ${item.time} T${item.type} ${item.color} D${item.duration} F:${feelings} N:${note}`,
    );
  });

  if (records.length > 25) {
    lines.push(`... ${records.length - 25} more records are omitted`);
  }

  lines.push('');
  lines.push('Note: This PDF uses ASCII for compatibility.');

  return lines;
}

function writeFile(filePath, content) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    fs.writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => resolve(filePath),
      fail: reject,
    });
  });
}

async function exportRecordsPdf(records) {
  const list = Array.isArray(records) ? records : [];
  const lines = buildReportLines(list);
  const pdfText = buildPdfText(lines);
  const filePath = `${wx.env.USER_DATA_PATH}/gut-report-${Date.now()}.pdf`;
  await writeFile(filePath, pdfText);
  return filePath;
}

module.exports = {
  exportRecordsPdf,
};
