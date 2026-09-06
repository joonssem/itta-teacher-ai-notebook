import { contextBridge, ipcRenderer } from 'electron';

import type {
  AiConnectRequest,
  GenerateAnnualSummaryRequest,
  GenerateRagRequest,
  AiOrganizeRequest,
  AiProviderId,
  AdoptTopicSuggestionRequest,
  CreateTopicRequest,
  GenerateWeeklySummaryRequest,
  GenerateMonthlySummaryRequest,
  GenerateProjectSummaryRequest,
  GenerateQuarterlySummaryRequest,
  GenerateSemesterSummaryRequest,
  GetWeeklyWorkspaceRequest,
  GetAnnualWorkspaceRequest,
  ImportKnowledgeRequest,
  KnowledgeSearchRequest,
  GetMonthlyWorkspaceRequest,
  GetProjectWorkspaceRequest,
  GetQuarterlyWorkspaceRequest,
  GetSemesterWorkspaceRequest,
  ImportRecordsResult,
  ListRecordsRequest,
  MarkdownDocumentTarget,
  MergeTopicsRequest,
  RegisterStudentNamesRequest,
  RestoreBackupRequest,
  SaveAnnualSummaryRequest,
  SaveRagRequest,
  SaveRecordRequest,
  SaveWeeklySummaryRequest,
  SaveMonthlySummaryRequest,
  SaveProjectSummaryRequest,
  SaveQuarterlySummaryRequest,
  SaveSemesterSummaryRequest,
  SaveMarkdownDocumentRequest,
  SemanticSearchRequest,
  TopicRecordRequest,
  UpdateDashboardCardRequest,
  UpdateNewsTopicsRequest,
  UpdateTopicRequest,
  UpdateRecordRequest,
} from './shared/contracts';

contextBridge.exposeInMainWorld('itta', {
  getStorageState: () => ipcRenderer.invoke('storage:get-state'),
  useDefaultStorage: () => ipcRenderer.invoke('storage:use-default'),
  chooseStorageDirectory: () => ipcRenderer.invoke('storage:choose-directory'),
  saveMarkdown: (request: SaveRecordRequest) =>
    ipcRenderer.invoke('records:save-markdown', request),
  importRecordFolder: (): Promise<ImportRecordsResult> =>
    ipcRenderer.invoke('records:import-folder'),
  listRecords: (request?: ListRecordsRequest) => ipcRenderer.invoke('records:list', request),
  getRecordDetail: (recordId: string) => ipcRenderer.invoke('records:get-detail', recordId),
  updateRecord: (request: UpdateRecordRequest) => ipcRenderer.invoke('records:update', request),
  inspectPrivacy: (content: string) => ipcRenderer.invoke('privacy:inspect', content),
  listStudentAliases: () => ipcRenderer.invoke('privacy:list-student-aliases'),
  registerStudentNames: (request: RegisterStudentNamesRequest) =>
    ipcRenderer.invoke('privacy:register-student-names', request),
  getAiState: () => ipcRenderer.invoke('ai:get-state'),
  connectAi: (request: AiConnectRequest) => ipcRenderer.invoke('ai:connect', request),
  disconnectAi: () => ipcRenderer.invoke('ai:disconnect'),
  skipAiSetup: (provider: AiProviderId, model: string) =>
    ipcRenderer.invoke('ai:skip-setup', provider, model),
  organizeRecord: (request: AiOrganizeRequest) =>
    ipcRenderer.invoke('ai:organize-record', request),
  searchSemantically: (request: SemanticSearchRequest) =>
    ipcRenderer.invoke('search:semantic', request),
  listTopics: () => ipcRenderer.invoke('topics:list'),
  createTopic: (request: CreateTopicRequest) => ipcRenderer.invoke('topics:create', request),
  adoptTopicSuggestion: (request: AdoptTopicSuggestionRequest) =>
    ipcRenderer.invoke('topics:adopt-suggestion', request),
  dismissTopicSuggestion: (normalizedName: string) =>
    ipcRenderer.invoke('topics:dismiss-suggestion', normalizedName),
  updateTopic: (request: UpdateTopicRequest) => ipcRenderer.invoke('topics:update', request),
  mergeTopics: (request: MergeTopicsRequest) => ipcRenderer.invoke('topics:merge', request),
  deleteTopic: (topicId: string) => ipcRenderer.invoke('topics:delete', topicId),
  linkTopicRecord: (request: TopicRecordRequest) =>
    ipcRenderer.invoke('topics:link-record', request),
  unlinkTopicRecord: (request: TopicRecordRequest) =>
    ipcRenderer.invoke('topics:unlink-record', request),
  getDashboardState: () => ipcRenderer.invoke('dashboard:get-state'),
  updateDashboardCard: (request: UpdateDashboardCardRequest) =>
    ipcRenderer.invoke('dashboard:update-card', request),
  getNewsState: () => ipcRenderer.invoke('news:get-state'),
  updateNewsTopics: (request: UpdateNewsTopicsRequest) =>
    ipcRenderer.invoke('news:update-topics', request),
  refreshNews: () => ipcRenderer.invoke('news:refresh'),
  openNewsItem: (itemId: string) => ipcRenderer.invoke('news:open-item', itemId),
  getWeeklyWorkspace: (request?: GetWeeklyWorkspaceRequest) =>
    ipcRenderer.invoke('weekly:get-workspace', request),
  generateWeeklySummary: (request: GenerateWeeklySummaryRequest) =>
    ipcRenderer.invoke('weekly:generate', request),
  saveWeeklySummary: (request: SaveWeeklySummaryRequest) =>
    ipcRenderer.invoke('weekly:save', request),
  showWeeklySummaryFile: (summaryId: string) =>
    ipcRenderer.invoke('weekly:show-file', summaryId),
  getMonthlyWorkspace: (request?: GetMonthlyWorkspaceRequest) =>
    ipcRenderer.invoke('monthly:get-workspace', request),
  generateMonthlySummary: (request: GenerateMonthlySummaryRequest) =>
    ipcRenderer.invoke('monthly:generate', request),
  saveMonthlySummary: (request: SaveMonthlySummaryRequest) =>
    ipcRenderer.invoke('monthly:save', request),
  showMonthlySummaryFile: (summaryId: string) =>
    ipcRenderer.invoke('monthly:show-file', summaryId),
  getQuarterlyWorkspace: (request?: GetQuarterlyWorkspaceRequest) =>
    ipcRenderer.invoke('quarterly:get-workspace', request),
  generateQuarterlySummary: (request: GenerateQuarterlySummaryRequest) =>
    ipcRenderer.invoke('quarterly:generate', request),
  saveQuarterlySummary: (request: SaveQuarterlySummaryRequest) =>
    ipcRenderer.invoke('quarterly:save', request),
  showQuarterlySummaryFile: (summaryId: string) =>
    ipcRenderer.invoke('quarterly:show-file', summaryId),
  getSemesterWorkspace: (request?: GetSemesterWorkspaceRequest) =>
    ipcRenderer.invoke('semester:get-workspace', request),
  generateSemesterSummary: (request: GenerateSemesterSummaryRequest) =>
    ipcRenderer.invoke('semester:generate', request),
  saveSemesterSummary: (request: SaveSemesterSummaryRequest) =>
    ipcRenderer.invoke('semester:save', request),
  showSemesterSummaryFile: (summaryId: string) =>
    ipcRenderer.invoke('semester:show-file', summaryId),
  getAnnualWorkspace: (request?: GetAnnualWorkspaceRequest) =>
    ipcRenderer.invoke('annual:get-workspace', request),
  generateAnnualSummary: (request: GenerateAnnualSummaryRequest) =>
    ipcRenderer.invoke('annual:generate', request),
  saveAnnualSummary: (request: SaveAnnualSummaryRequest) =>
    ipcRenderer.invoke('annual:save', request),
  showAnnualSummaryFile: (summaryId: string) =>
    ipcRenderer.invoke('annual:show-file', summaryId),
  getProjectWorkspace: (request?: GetProjectWorkspaceRequest) =>
    ipcRenderer.invoke('project:get-workspace', request),
  generateProjectSummary: (request: GenerateProjectSummaryRequest) =>
    ipcRenderer.invoke('project:generate', request),
  saveProjectSummary: (request: SaveProjectSummaryRequest) =>
    ipcRenderer.invoke('project:save', request),
  showProjectSummaryFile: (summaryId: string) =>
    ipcRenderer.invoke('project:show-file', summaryId),
  getKnowledgeState: () => ipcRenderer.invoke('knowledge:get-state'),
  importKnowledgeFiles: (request: ImportKnowledgeRequest) =>
    ipcRenderer.invoke('knowledge:import', request),
  removeKnowledgeSource: (sourceId: string) =>
    ipcRenderer.invoke('knowledge:remove-source', sourceId),
  searchKnowledge: (request: KnowledgeSearchRequest) =>
    ipcRenderer.invoke('knowledge:search', request),
  generateRagConnection: (request: GenerateRagRequest) =>
    ipcRenderer.invoke('knowledge:generate-rag', request),
  saveRagConnection: (request: SaveRagRequest) =>
    ipcRenderer.invoke('knowledge:save-rag', request),
  listRagConnections: () => ipcRenderer.invoke('knowledge:list-rag'),
  showKnowledgeSourceFile: (sourceId: string) =>
    ipcRenderer.invoke('knowledge:show-source', sourceId),
  showRagConnectionFile: (connectionId: string) =>
    ipcRenderer.invoke('knowledge:show-rag', connectionId),
  getMarkdownDocument: (target: MarkdownDocumentTarget) =>
    ipcRenderer.invoke('markdown-document:get', target),
  saveMarkdownDocument: (request: SaveMarkdownDocumentRequest) =>
    ipcRenderer.invoke('markdown-document:save', request),
  showMarkdownDocumentFile: (target: MarkdownDocumentTarget) =>
    ipcRenderer.invoke('markdown-document:show-file', target),
  trashRecord: (recordId: string) => ipcRenderer.invoke('records:trash', recordId),
  restoreRecord: (recordId: string) => ipcRenderer.invoke('records:restore', recordId),
  showRecordFile: (recordId: string) => ipcRenderer.invoke('records:show-file', recordId),
  getBackupState: () => ipcRenderer.invoke('backup:get-state'),
  createBackupNow: () => ipcRenderer.invoke('backup:create-now'),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  chooseBackupForRestore: () => ipcRenderer.invoke('backup:choose-restore'),
  restoreBackup: (request: RestoreBackupRequest) =>
    ipcRenderer.invoke('backup:restore', request),
  showBackupFolder: () => ipcRenderer.invoke('backup:show-folder'),
});
