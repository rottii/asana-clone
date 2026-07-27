export const GITHUB_PR_STATUSES = [
  'Merged', 'Approved', 'Changes requested', 'In review', 'No reviews', 'Open', 'Draft', 'Closed'
];

export const GITHUB_PR_OPTIONS = [
  { id: 'pr-merged', label: 'Merged', color: '#8b5cf6' },
  { id: 'pr-approved', label: 'Approved', color: '#10b981' },
  { id: 'pr-changes', label: 'Changes requested', color: '#ef4444' },
  { id: 'pr-review', label: 'In review', color: '#f59e0b' },
  { id: 'pr-noreview', label: 'No reviews', color: '#9ca3af' },
  { id: 'pr-open', label: 'Open', color: '#3b82f6' },
  { id: 'pr-draft', label: 'Draft', color: '#6b7280' },
  { id: 'pr-closed', label: 'Closed', color: '#ef4444' }
];

export const GITHUB_PR_SORT_MAP = {
  'Merged': 1, 'Approved': 2, 'Changes requested': 3, 'In review': 4, 'No reviews': 5, 'Open': 6, 'Draft': 7, 'Closed': 8, 'Empty': 9
};

export const getParsedGithubPRs = (githubPRsStr) => {
  if (!githubPRsStr) return [];
  if (typeof githubPRsStr === 'string') {
    try { return JSON.parse(githubPRsStr); } catch(e) { return []; }
  }
  if (Array.isArray(githubPRsStr)) return githubPRsStr;
  return [];
};

export const getGithubPRStatusLabel = (pr) => {
  if (!pr) return 'Empty';
  if (pr.merged) return 'Merged';
  if (pr.state === 'closed') return 'Closed';
  if (pr.draft) return 'Draft';
  if (pr.reviewStatus) return pr.reviewStatus;
  return 'Open';
};

export const getGithubPRStatusColor = (pr) => {
  if (!pr) return '#6E7681';
  if (pr.state === 'closed' && pr.merged) return '#8250DF'; 
  if (pr.state === 'closed') return '#CF222E'; 
  if (pr.draft) return '#6E7681';
  if (pr.reviewStatus === 'Approved') return '#2DA44E'; 
  if (pr.reviewStatus === 'Changes requested') return '#CF222E'; 
  return '#1A7F37';
};

export const getParsedCustomFields = (proj) => {
  if (!proj || !proj.customFieldSettings) return [];
  let fields = proj.customFieldSettings;
  if (typeof fields === 'string') {
    try { fields = JSON.parse(fields); } catch(e) { return []; }
  }
  if (!Array.isArray(fields)) return [];
  
  return fields.map(f => {
    if ((f.type === 'github_pr' || f.fieldType === 'github_pr') && (!f.options || f.options.length === 0)) {
      return {
        ...f,
        options: GITHUB_PR_OPTIONS
      };
    }
    return f;
  });
};

export const getParsedTaskCustomFields = (taskFieldsStr) => {
  if (!taskFieldsStr) return {};
  if (typeof taskFieldsStr === 'string') {
    try { return JSON.parse(taskFieldsStr); } catch(e) { return {}; }
  }
  if (typeof taskFieldsStr === 'object') return taskFieldsStr;
  return {};
};
