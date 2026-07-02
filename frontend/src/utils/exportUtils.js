/**
 * Export utilities with dynamic imports — PDF/Excel libs load only on use.
 */

/**
 * @param {string} title
 * @param {Array} columns
 * @param {Array} data
 * @param {string} [filename]
 */
export const exportToPDF = async (
  title,
  columns,
  data,
  filename = "relatorio.pdf",
) => {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF();

  doc.text(title, 14, 20);

  doc.autoTable({
    args: { margin: { bottom: 20 } },
    startY: 30,
    head: [columns],
    body: data,
    styles: { fontSize: 8 },
  });

  doc.save(filename);
};

/**
 * @param {Array<Record<string, unknown>>} data
 * @param {string} [filename]
 */
export const exportToExcel = async (data, filename = "relatorio.xlsx") => {
  const ExcelJS = (await import("exceljs")).default;
  const { saveAs } = await import("file-saver");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Relatório");

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(header.length, 12),
    }));
    worksheet.addRows(data);
  }

  const excelBuffer = await workbook.xlsx.writeBuffer();
  const dataBlob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });
  saveAs(dataBlob, filename);
};
