import React from "react";
import { Button } from "./ui";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pageNumbers = [];
  const maxPagesToShow = 5;

  if (totalPages <= 1) {
    return null;
  }

  let startPage;
  let endPage;
  if (totalPages <= maxPagesToShow) {
    startPage = 1;
    endPage = totalPages;
  } else {
    const maxPagesBeforeCurrent = Math.floor(maxPagesToShow / 2);
    const maxPagesAfterCurrent = Math.ceil(maxPagesToShow / 2) - 1;
    if (currentPage <= maxPagesBeforeCurrent) {
      startPage = 1;
      endPage = maxPagesToShow;
    } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
      startPage = totalPages - maxPagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - maxPagesBeforeCurrent;
      endPage = currentPage + maxPagesAfterCurrent;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <nav
      className="relative mt-5 flex items-center justify-between gap-2 border-t border-border pt-4 sm:justify-center"
      aria-label="Paginação"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Anterior
      </Button>

      {startPage > 1 && (
        <>
          <Button
            className="hidden min-w-10 sm:inline-flex"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            aria-current={currentPage === 1 ? "page" : undefined}
          >
            1
          </Button>
          {startPage > 2 && (
            <span className="hidden px-2 text-text-light sm:inline" aria-hidden="true">
              …
            </span>
          )}
        </>
      )}

      {pageNumbers.map((number) => (
        <Button
          key={number}
          className="hidden min-w-10 sm:inline-flex"
          variant={currentPage === number ? "primary" : "outline"}
          size="sm"
          onClick={() => onPageChange(number)}
          aria-current={currentPage === number ? "page" : undefined}
        >
          {number}
        </Button>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="hidden px-2 text-text-light sm:inline" aria-hidden="true">
              …
            </span>
          )}
          <Button
            className="hidden min-w-10 sm:inline-flex"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            aria-current={currentPage === totalPages ? "page" : undefined}
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Próxima
      </Button>
      <span className="absolute left-1/2 -translate-x-1/2 text-xs font-medium text-text-secondary sm:hidden">
        Página {currentPage} de {totalPages}
      </span>
    </nav>
  );
};

export default Pagination;
