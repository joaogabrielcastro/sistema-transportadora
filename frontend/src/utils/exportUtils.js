import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * Export data to PDF using jsPDF and jspdf-autotable
 * @param {string} title - Title of the report
 * @param {Array} columns - Array of column headers
 * @param {Array} data - Array of arrays (rows) matching columns
 * @param {string} filename - Output filename
 */
export const exportToPDF = (
  title,
  columns,
  data,
  filename = "relatorio.pdf",
) => {
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
 * Export data to Excel using xlsx and file-saver
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Output filename
 */
export const exportToExcel = (data, filename = "relatorio.xlsx") => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const dataBlob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });
  saveAs(dataBlob, filename);
};
