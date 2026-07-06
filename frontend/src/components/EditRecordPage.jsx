import React from "react";
import PageLayout from "./layout/PageLayout.jsx";
import Breadcrumbs from "./layout/Breadcrumbs.jsx";
import { PageHeader } from "./ui";
import { CardSkeleton } from "./Skeleton.jsx";

export default function EditRecordPage({
  title,
  subtitle,
  breadcrumbItems,
  loading,
  error,
  onBack,
  backLabel = "Voltar",
  children,
}) {
  if (loading) {
    return (
      <PageLayout className="space-y-6">
        <PageHeader title={title} subtitle={subtitle} />
        <CardSkeleton lines={8} />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout className="space-y-6">
        {breadcrumbItems?.length > 0 && (
          <Breadcrumbs items={breadcrumbItems} />
        )}
        <PageHeader title={title} subtitle={subtitle} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-blue-600 hover:underline"
          >
            {backLabel}
          </button>
        )}
      </PageLayout>
    );
  }

  return (
    <PageLayout className="space-y-6">
      {breadcrumbItems?.length > 0 && (
        <Breadcrumbs items={breadcrumbItems} />
      )}
      <PageHeader title={title} subtitle={subtitle} />
      {children}
    </PageLayout>
  );
}
