import React from "react";
import PropTypes from "prop-types";

const cellBase =
  "px-3 py-2.5 text-sm text-text-primary align-middle first:pl-4 last:pr-4 md:first:pl-5 md:last:pr-5";

export const DataTable = ({ children, fixed = true, className = "" }) => (
  <div className={`w-full overflow-x-auto ${className}`}>
    <table
      className={`w-full divide-y divide-border text-sm ${
        fixed ? "md:table-fixed" : "table-auto"
      }`}
    >
      {children}
    </table>
  </div>
);

DataTable.propTypes = {
  children: PropTypes.node,
  fixed: PropTypes.bool,
  className: PropTypes.string,
};

export const DataTableHead = ({ children }) => (
  <thead className="bg-gray-50/90 sticky top-0 z-10 backdrop-blur-sm">
    {children}
  </thead>
);

DataTableHead.propTypes = { children: PropTypes.node };

export const DataTableBody = ({ children }) => (
  <tbody className="bg-white divide-y divide-border">{children}</tbody>
);

DataTableBody.propTypes = { children: PropTypes.node };

export const DataTableRow = ({ children, className = "", onClick }) => (
  <tr
    className={`hover:bg-gray-50/80 transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

DataTableRow.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  onClick: PropTypes.func,
};

export const DataTableTh = ({ children, className = "", align = "left", width }) => (
  <th
    scope="col"
    style={width ? { width } : undefined}
    className={`${cellBase} py-2 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap ${
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
    } ${className}`}
  >
    {children}
  </th>
);

DataTableTh.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  align: PropTypes.oneOf(["left", "center", "right"]),
  width: PropTypes.string,
};

export const DataTableTd = ({
  children,
  className = "",
  align = "left",
  truncate = false,
  title,
}) => (
  <td
    title={title}
    className={`${cellBase} ${
      align === "right"
        ? "text-right"
        : align === "center"
          ? "text-center"
          : "text-left"
    } ${truncate ? "truncate max-w-0" : ""} ${className}`}
  >
    {children}
  </td>
);

DataTableTd.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  align: PropTypes.oneOf(["left", "center", "right"]),
  truncate: PropTypes.bool,
  title: PropTypes.string,
};

const actionBtn =
  "inline-flex items-center justify-center p-1.5 rounded-md text-text-secondary hover:text-primary hover:bg-primary/5 transition-colors disabled:opacity-40";

export const TableRowActions = ({ onEdit, onView, onDelete, editTitle = "Editar", viewTitle = "Ver detalhes", deleteTitle = "Excluir" }) => (
  <div className="flex items-center justify-end gap-0.5 shrink-0">
    {onEdit && (
      <button type="button" onClick={onEdit} className={actionBtn} title={editTitle} aria-label={editTitle}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    )}
    {onView && (
      <button type="button" onClick={onView} className={actionBtn} title={viewTitle} aria-label={viewTitle}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    )}
    {onDelete && (
      <button type="button" onClick={onDelete} className={`${actionBtn} hover:text-danger hover:bg-red-50`} title={deleteTitle} aria-label={deleteTitle}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    )}
  </div>
);

TableRowActions.propTypes = {
  onEdit: PropTypes.func,
  onView: PropTypes.func,
  onDelete: PropTypes.func,
  editTitle: PropTypes.string,
  viewTitle: PropTypes.string,
  deleteTitle: PropTypes.string,
};
