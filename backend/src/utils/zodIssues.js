/** Zod 4 usa `issues`; versões antigas usavam `errors`. */
export const getZodIssues = (err) => {
  if (!err || typeof err !== "object") return [];
  if (Array.isArray(err.issues)) return err.issues;
  if (Array.isArray(err.errors)) return err.errors;
  return [];
};

export const formatZodIssueLines = (err) =>
  getZodIssues(err).map((issue) => {
    const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
    return path ? `${path}: ${issue.message}` : issue.message;
  });
