/**
 * Export utilities with dynamic imports — PDF/Excel libs load only on use.
 */

/**
 * @param {string} title
 * @param {string[]} columns
 * @param {Array<Array<string|number>>} data
 * @param {string} [filename]
 * @param {{ sections?: Array<{ title: string, columns: string[], rows: Array<Array<string|number>> }> }} [extra]
 */
export const exportToPDF = async (
  title,
  columns,
  data,
  filename = "relatorio.pdf",
  extra = {},
) => {
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule.autoTable;

  if (typeof autoTable !== "function") {
    throw new Error("Falha ao carregar o gerador de tabelas do PDF.");
  }

  const doc = new jsPDF();
  const sections =
    Array.isArray(extra.sections) && extra.sections.length > 0
      ? extra.sections
      : [{ title, columns, rows: data }];

  let startY = 16;

  for (const section of sections) {
    const sectionTitle = section.title || title;
    const sectionColumns = section.columns || columns;
    const sectionRows = Array.isArray(section.rows) ? section.rows : [];

    if (startY > 270) {
      doc.addPage();
      startY = 16;
    }

    doc.setFontSize(14);
    doc.text(String(sectionTitle), 14, startY);
    startY += 8;

    autoTable(doc, {
      startY,
      head: [sectionColumns],
      body:
        sectionRows.length > 0
          ? sectionRows
          : [["Nenhum dado para exibir no período selecionado."]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      margin: { left: 14, right: 14, bottom: 16 },
    });

    startY = (doc.lastAutoTable?.finalY ?? startY) + 14;
  }

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
