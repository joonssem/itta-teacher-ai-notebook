export interface StorageState {
  path: string;
  isCustom: boolean;
  isConfigured: boolean;
}

export interface TeacherRecord {
  id: string;
  recordDate: string;
  content: string;
  categories: string[];
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  aiStatus: AiReviewStatus;
  aiReview: AiOrganizationDraft | null;
}

export interface SaveRecordRequest {
  content: string;
  recordDate: string;
  categories: string[];
  privacyReviewed: boolean;
  aiStatus?: AiReviewStatus;
  aiReview?: AiOrganizationDraft | null;
}

export interface SaveRecordResult {
  filePath: string;
  savedAt: string;
  record: TeacherRecord;
}

export interface RecordImportIssue {
  fileName: string;
  reason: string;
  privacyFindingCount?: number;
}

export interface ImportRecordsResult {
  canceled: boolean;
  sourceDirectory: string | null;
  totalFiles: number;
  importedCount: number;
  duplicateCount: number;
  privacyBlockedCount: number;
  invalidCount: number;
  issues: RecordImportIssue[];
}

export interface ListRecordsRequest {
  query?: string;
  includeDeleted?: boolean;
  limit?: number;
  topicId?: string;
  dateStart?: string;
  dateEnd?: string;
}

export interface UpdateRecordRequest {
  id: string;
  content: string;
  categories: string[];
  privacyReviewed: boolean;
  aiStatus?: AiReviewStatus;
  aiReview?: AiOrganizationDraft | null;
}

export type PrivacyFindingKind =
  | 'student-name'
  | 'phone'
  | 'email'
  | 'resident-number'
  | 'address'
  | 'account';

export interface PrivacyFinding {
  id: string;
  kind: PrivacyFindingKind;
  label: string;
  value: string;
  replacement: string;
  start: number;
  end: number;
}

export interface PrivacyDecision {
  findingId: string;
  replace: boolean;
  replacement: string;
}

export interface PrivacyInspectionResult {
  academicYear: number;
  findings: PrivacyFinding[];
}

export interface StudentAlias {
  id: string;
  academicYear: number;
  realName: string;
  alias: string;
  createdAt: string;
}

export interface StudentAliasState {
  academicYear: number;
  encryptionAvailable: boolean;
  aliases: StudentAlias[];
}

export interface RegisterStudentNamesRequest {
  names: string[];
}

export type AiProviderId = 'upstage' | 'google';

export interface AiProviderOption {
  id: AiProviderId;
  name: string;
  description: string;
  connectionNote: string;
  models: Array<{
    id: string;
    name: string;
  }>;
}

export interface AiSessionStatus {
  connected: boolean;
  provider: AiProviderId | null;
  model: string | null;
  keyHint: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
}

export interface AiSettingsState {
  setupCompleted: boolean;
  preferredProvider: AiProviderId;
  preferredModel: string;
  providers: AiProviderOption[];
  session: AiSessionStatus;
}

export interface AiConnectRequest {
  provider: AiProviderId;
  model: string;
  apiKey: string;
}

export type AiSectionId =
  | 'summary'
  | 'strengths'
  | 'reminders'
  | 'curriculumConnections'
  | 'nextActions'
  | 'reflectionQuestions'
  | 'alternativePerspectives';

export type AiPresetId = 'concise' | 'balanced' | 'deep' | 'custom';

export interface AiOrganizeOptions {
  preset: AiPresetId;
  sections: AiSectionId[];
  reflectionLevel: number;
}

export interface AiOrganizationResult {
  summary: string;
  strengths: string[];
  reminders: string[];
  curriculumConnections: string[];
  nextActions: string[];
  reflectionQuestions: string[];
  alternativePerspectives: string[];
  categories: string[];
  topics: string[];
}

export interface AiOrganizationDraft {
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  options: AiOrganizeOptions;
  result: AiOrganizationResult;
}

export type AiReviewStatus = 'none' | 'adopted' | 'rejected';

export interface AiOrganizeRequest {
  content: string;
  options: AiOrganizeOptions;
}

export interface SemanticSearchRequest {
  query: string;
}

export interface SemanticSearchAiMatch {
  recordId: string;
  score: number;
  reason: string;
  matchedConcepts: string[];
}

export interface SemanticSearchAiResult {
  interpretation: string;
  results: SemanticSearchAiMatch[];
}

export interface SemanticSearchMatch {
  record: TeacherRecord;
  score: number;
  reason: string;
  matchedConcepts: string[];
}

export interface SemanticSearchResponse {
  query: string;
  interpretation: string;
  searchedRecordCount: number;
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  matches: SemanticSearchMatch[];
}

export type TopicSource = 'teacher' | 'ai';

export interface TopicSummary {
  id: string;
  name: string;
  source: TopicSource;
  pinned: boolean;
  hidden: boolean;
  recordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicSuggestion {
  normalizedName: string;
  name: string;
  recordCount: number;
  recordIds: string[];
}

export interface TopicState {
  topics: TopicSummary[];
  suggestions: TopicSuggestion[];
}

export interface CreateTopicRequest {
  name: string;
  recordIds?: string[];
}

export interface CreateTopicResult {
  state: TopicState;
  topicId: string;
}

export interface AdoptTopicSuggestionRequest {
  normalizedName: string;
  name: string;
}

export interface UpdateTopicRequest {
  id: string;
  name?: string;
  pinned?: boolean;
  hidden?: boolean;
}

export interface MergeTopicsRequest {
  sourceId: string;
  targetId: string;
}

export interface TopicRecordRequest {
  topicId: string;
  recordId: string;
}

export type DashboardCardKind =
  | 'new-topic'
  | 'connected-records'
  | 'category-pattern'
  | 'weekly-summary'
  | 'next-action';

export type DashboardCardStatus = 'active' | 'hidden' | 'dismissed';

export interface DashboardCard {
  key: string;
  kind: DashboardCardKind;
  title: string;
  description: string;
  reason: string;
  priority: number;
  pinned: boolean;
  status: DashboardCardStatus;
  action: 'topics' | 'records' | 'record' | 'weekly';
  actionLabel: string;
  actionQuery: string | null;
  evidenceRecords: TeacherRecord[];
}

export interface DashboardState {
  cards: DashboardCard[];
  suppressedCards: DashboardCard[];
}

export interface UpdateDashboardCardRequest {
  key: string;
  pinned?: boolean;
  status?: DashboardCardStatus;
}

export interface NewsItem {
  id: string;
  topic: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface NewsState {
  topics: string[];
  items: NewsItem[];
  lastFetchedAt: string | null;
  lastAttemptDate: string | null;
  needsRefresh: boolean;
  error: string | null;
}

export interface UpdateNewsTopicsRequest {
  topics: string[];
}

export interface WeeklySummaryResult {
  overview: string;
  teachingActivities: string[];
  classroomGuidance: string[];
  strengths: string[];
  changesAndConcerns: string[];
  reminders: string[];
  nextWeekActions: string[];
}

export interface WeeklySummaryDraft {
  weekStart: string;
  weekEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  reflectionLevel: number;
  result: WeeklySummaryResult;
}

export interface WeeklySummary {
  id: string;
  weekStart: string;
  weekEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: WeeklySummaryResult;
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyWorkspace {
  weekStart: string;
  weekEnd: string;
  records: TeacherRecord[];
  summaries: WeeklySummary[];
}

export interface GetWeeklyWorkspaceRequest {
  anchorDate?: string;
}

export interface GenerateWeeklySummaryRequest {
  weekStart: string;
  weekEnd: string;
  recordIds: string[];
  reflectionLevel: number;
}

export interface SaveWeeklySummaryRequest {
  draft: WeeklySummaryDraft;
}

export interface MonthlySummaryResult {
  overview: string;
  teachingThreads: string[];
  classroomGuidancePatterns: string[];
  strengthsAndGrowth: string[];
  recurringConcerns: string[];
  projectConnections: string[];
  reminders: string[];
  nextMonthPriorities: string[];
}

export interface MonthlySummaryDraft {
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  reflectionLevel: number;
  result: MonthlySummaryResult;
}

export interface MonthlySummary {
  id: string;
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: MonthlySummaryResult;
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyWorkspace {
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  records: TeacherRecord[];
  summaries: MonthlySummary[];
}

export interface GetMonthlyWorkspaceRequest {
  monthKey?: string;
}

export interface GenerateMonthlySummaryRequest {
  monthKey: string;
  monthStart: string;
  monthEnd: string;
  recordIds: string[];
  reflectionLevel: number;
}

export interface SaveMonthlySummaryRequest {
  draft: MonthlySummaryDraft;
}

export interface QuarterlySummaryResult {
  overview: string;
  monthlyProgression: string[];
  teachingProjects: string[];
  classroomCultureChanges: string[];
  strengthsAndGrowth: string[];
  recurringConcerns: string[];
  projectAndCurriculumConnections: string[];
  reminders: string[];
  nextQuarterPriorities: string[];
}

export interface QuarterlySummaryDraft {
  quarterKey: string;
  quarterStart: string;
  quarterEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  reflectionLevel: number;
  result: QuarterlySummaryResult;
}

export interface QuarterlySummary {
  id: string;
  quarterKey: string;
  quarterStart: string;
  quarterEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: QuarterlySummaryResult;
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuarterlyWorkspace {
  quarterKey: string;
  quarterStart: string;
  quarterEnd: string;
  records: TeacherRecord[];
  summaries: QuarterlySummary[];
}

export interface GetQuarterlyWorkspaceRequest {
  quarterKey?: string;
}

export interface GenerateQuarterlySummaryRequest {
  quarterKey: string;
  quarterStart: string;
  quarterEnd: string;
  recordIds: string[];
  reflectionLevel: number;
}

export interface SaveQuarterlySummaryRequest {
  draft: QuarterlySummaryDraft;
}

export interface SemesterSummaryResult {
  overview: string;
  periodProgression: string[];
  teachingAndCurriculumThreads: string[];
  classroomCultureChanges: string[];
  strengthsAndGrowth: string[];
  recurringConcerns: string[];
  projectOutcomesAndConnections: string[];
  reminders: string[];
  nextSemesterPriorities: string[];
}

export interface SemesterSummaryDraft {
  semesterKey: string;
  semesterStart: string;
  semesterEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  reflectionLevel: number;
  result: SemesterSummaryResult;
}

export interface SemesterSummary {
  id: string;
  semesterKey: string;
  semesterStart: string;
  semesterEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: SemesterSummaryResult;
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface SemesterWorkspace {
  semesterKey: string;
  semesterStart: string;
  semesterEnd: string;
  records: TeacherRecord[];
  summaries: SemesterSummary[];
}

export interface GetSemesterWorkspaceRequest {
  semesterKey?: string;
}

export interface GenerateSemesterSummaryRequest {
  semesterKey: string;
  semesterStart: string;
  semesterEnd: string;
  recordIds: string[];
  reflectionLevel: number;
}

export interface SaveSemesterSummaryRequest {
  draft: SemesterSummaryDraft;
}

export interface AnnualSummaryResult {
  overview: string;
  semesterProgression: string[];
  teachingAndCurriculumJourney: string[];
  classroomCultureAndGuidance: string[];
  strengthsAndGrowth: string[];
  recurringConcerns: string[];
  projectOutcomesAndLegacy: string[];
  reminders: string[];
  nextAcademicYearPriorities: string[];
}

export interface AnnualSummaryDraft {
  academicYear: string;
  yearStart: string;
  yearEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  reflectionLevel: number;
  result: AnnualSummaryResult;
}

export interface AnnualSummary {
  id: string;
  academicYear: string;
  yearStart: string;
  yearEnd: string;
  recordIds: string[];
  provider: AiProviderId;
  model: string;
  result: AnnualSummaryResult;
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualWorkspace {
  academicYear: string;
  yearStart: string;
  yearEnd: string;
  records: TeacherRecord[];
  summaries: AnnualSummary[];
}

export interface GetAnnualWorkspaceRequest {
  academicYear?: string;
}

export interface GenerateAnnualSummaryRequest {
  academicYear: string;
  yearStart: string;
  yearEnd: string;
  recordIds: string[];
  reflectionLevel: number;
}

export interface SaveAnnualSummaryRequest {
  draft: AnnualSummaryDraft;
}

export interface ProjectSummaryResult {
  overview: string;
  guidingQuestions: string[];
  learningJourney: string[];
  studentArtifacts: string[];
  studentLearningEvidence: string[];
  teacherReflection: string[];
  curriculumConnections: string[];
  educationEvidenceConnections: ProjectEvidenceConnection[];
  nextExtensions: string[];
}

export interface ProjectEvidenceConnection {
  statement: string;
  chunkIds: string[];
}

export interface ProjectSummaryDraft {
  title: string;
  seedQuestion: string;
  periodStart: string;
  periodEnd: string;
  recordIds: string[];
  knowledgeChunkIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  reflectionLevel: number;
  result: ProjectSummaryResult;
}

export interface ProjectSummary {
  id: string;
  title: string;
  seedQuestion: string;
  periodStart: string;
  periodEnd: string;
  recordIds: string[];
  knowledgeChunkIds: string[];
  provider: AiProviderId;
  model: string;
  result: ProjectSummaryResult;
  markdownPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWorkspace {
  periodStart: string;
  periodEnd: string;
  records: TeacherRecord[];
  summaries: ProjectSummary[];
}

export interface GetProjectWorkspaceRequest {
  periodStart?: string;
  periodEnd?: string;
}

export interface GenerateProjectSummaryRequest {
  title: string;
  seedQuestion: string;
  periodStart: string;
  periodEnd: string;
  recordIds: string[];
  knowledgeChunkIds: string[];
  reflectionLevel: number;
}

export interface SaveProjectSummaryRequest {
  draft: ProjectSummaryDraft;
}

export type KnowledgeSourceKind = 'curriculum' | 'theory' | 'other';
export type KnowledgeFileType = 'pdf' | 'docx' | 'hwpx' | 'markdown' | 'text';

export interface KnowledgeSource {
  id: string;
  title: string;
  originalName: string;
  kind: KnowledgeSourceKind;
  fileType: KnowledgeFileType;
  storedPath: string;
  contentHash: string;
  characterCount: number;
  chunkCount: number;
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceKind: KnowledgeSourceKind;
  chunkIndex: number;
  content: string;
}

export interface KnowledgeSearchHit extends KnowledgeChunk {
  score: number;
}

export interface KnowledgeState {
  sources: KnowledgeSource[];
  totalChunks: number;
}

export interface ImportKnowledgeRequest {
  kind: KnowledgeSourceKind;
}

export interface KnowledgeSearchRequest {
  query: string;
  recordId?: string;
}

export interface KnowledgeSearchResponse {
  query: string;
  recordId: string | null;
  hits: KnowledgeSearchHit[];
}

export interface RagConnection {
  statement: string;
  chunkIds: string[];
}

export interface RagResult {
  overview: string;
  connections: RagConnection[];
  encouragements: string[];
  reminders: string[];
  reflectionQuestions: string[];
  nextActions: string[];
}

export interface RagDraft {
  recordId: string;
  query: string;
  chunkIds: string[];
  provider: AiProviderId;
  model: string;
  generatedAt: string;
  result: RagResult;
}

export interface SavedRagConnection {
  id: string;
  recordId: string;
  query: string;
  chunkIds: string[];
  provider: AiProviderId;
  model: string;
  result: RagResult;
  markdownPath: string;
  createdAt: string;
}

export interface GenerateRagRequest {
  recordId: string;
  query: string;
  chunkIds: string[];
}

export interface SaveRagRequest {
  draft: RagDraft;
}

export type BackupKind = 'automatic' | 'manual' | 'pre-restore';

export interface BackupCounts {
  records: number;
  weeklySummaries: number;
  monthlySummaries: number;
  quarterlySummaries: number;
  semesterSummaries: number;
  annualSummaries: number;
  projectSummaries: number;
  knowledgeSources: number;
  knowledgeConnections: number;
  topics: number;
  studentAliases: number;
}

export interface BackupFileEntry {
  entityType: 'record' | 'weekly-summary' | 'monthly-summary' | 'quarterly-summary' | 'semester-summary' | 'annual-summary' | 'project-summary' | 'knowledge-source' | 'knowledge-connection';
  entityId: string;
  relativePath: string;
  backupPath: string;
  size: number;
}

export interface BackupMissingFile {
  entityType: BackupFileEntry['entityType'];
  entityId: string;
}

export interface BackupManifest {
  formatVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  appVersion: string;
  createdAt: string;
  kind: BackupKind;
  originalStorageFolderName: string;
  deviceBoundStudentAliases: boolean;
  counts: BackupCounts;
  files: BackupFileEntry[];
  missingFiles: BackupMissingFile[];
}

export interface BackupSummary {
  path: string;
  createdAt: string;
  kind: BackupKind;
  counts: BackupCounts;
}

export interface BackupInspection {
  path: string;
  valid: boolean;
  manifest: BackupManifest | null;
  warnings: string[];
}

export interface BackupState {
  backupDirectory: string;
  lastAutomaticBackupAt: string | null;
  automaticBackups: BackupSummary[];
  inProgress: boolean;
  lastError: string | null;
}

export interface RestoreBackupRequest {
  backupPath: string;
  confirmation: string;
}

export interface RestoreBackupResult {
  storageRoot: string;
  preRestoreBackupPath: string;
  restoredCounts: BackupCounts;
  warnings: string[];
}

export type MarkdownDocumentKind =
  | 'weekly-summary'
  | 'monthly-summary'
  | 'quarterly-summary'
  | 'semester-summary'
  | 'annual-summary'
  | 'project-summary'
  | 'rag-connection';

export interface MarkdownDocumentTarget {
  kind: MarkdownDocumentKind;
  id: string;
}

export interface EditableMarkdownDocument extends MarkdownDocumentTarget {
  title: string;
  kindLabel: string;
  fileName: string;
  body: string;
  revision: string;
  modifiedAt: string;
  metadataProtected: boolean;
  linkedRecords: TeacherRecord[];
}

export interface LinkedMarkdownDocument extends MarkdownDocumentTarget {
  title: string;
  kindLabel: string;
  context: string;
  createdAt: string;
}

export interface RecordDetail {
  record: TeacherRecord;
  backlinks: LinkedMarkdownDocument[];
}

export interface SaveMarkdownDocumentRequest extends MarkdownDocumentTarget {
  body: string;
  revision: string;
}

export interface IttaBridge {
  getStorageState: () => Promise<StorageState>;
  useDefaultStorage: () => Promise<StorageState>;
  chooseStorageDirectory: () => Promise<StorageState>;
  saveMarkdown: (request: SaveRecordRequest) => Promise<SaveRecordResult>;
  importRecordFolder: () => Promise<ImportRecordsResult>;
  listRecords: (request?: ListRecordsRequest) => Promise<TeacherRecord[]>;
  getRecordDetail: (recordId: string) => Promise<RecordDetail>;
  updateRecord: (request: UpdateRecordRequest) => Promise<TeacherRecord>;
  inspectPrivacy: (content: string) => Promise<PrivacyInspectionResult>;
  listStudentAliases: () => Promise<StudentAliasState>;
  registerStudentNames: (request: RegisterStudentNamesRequest) => Promise<StudentAliasState>;
  getAiState: () => Promise<AiSettingsState>;
  connectAi: (request: AiConnectRequest) => Promise<AiSettingsState>;
  disconnectAi: () => Promise<AiSettingsState>;
  skipAiSetup: (provider: AiProviderId, model: string) => Promise<AiSettingsState>;
  organizeRecord: (request: AiOrganizeRequest) => Promise<AiOrganizationDraft>;
  searchSemantically: (request: SemanticSearchRequest) => Promise<SemanticSearchResponse>;
  listTopics: () => Promise<TopicState>;
  createTopic: (request: CreateTopicRequest) => Promise<CreateTopicResult>;
  adoptTopicSuggestion: (request: AdoptTopicSuggestionRequest) => Promise<TopicState>;
  dismissTopicSuggestion: (normalizedName: string) => Promise<TopicState>;
  updateTopic: (request: UpdateTopicRequest) => Promise<TopicState>;
  mergeTopics: (request: MergeTopicsRequest) => Promise<TopicState>;
  deleteTopic: (topicId: string) => Promise<TopicState>;
  linkTopicRecord: (request: TopicRecordRequest) => Promise<TopicState>;
  unlinkTopicRecord: (request: TopicRecordRequest) => Promise<TopicState>;
  getDashboardState: () => Promise<DashboardState>;
  updateDashboardCard: (request: UpdateDashboardCardRequest) => Promise<DashboardState>;
  getNewsState: () => Promise<NewsState>;
  updateNewsTopics: (request: UpdateNewsTopicsRequest) => Promise<NewsState>;
  refreshNews: () => Promise<NewsState>;
  openNewsItem: (itemId: string) => Promise<boolean>;
  getWeeklyWorkspace: (request?: GetWeeklyWorkspaceRequest) => Promise<WeeklyWorkspace>;
  generateWeeklySummary: (request: GenerateWeeklySummaryRequest) => Promise<WeeklySummaryDraft>;
  saveWeeklySummary: (request: SaveWeeklySummaryRequest) => Promise<WeeklySummary>;
  showWeeklySummaryFile: (summaryId: string) => Promise<boolean>;
  getMonthlyWorkspace: (request?: GetMonthlyWorkspaceRequest) => Promise<MonthlyWorkspace>;
  generateMonthlySummary: (request: GenerateMonthlySummaryRequest) => Promise<MonthlySummaryDraft>;
  saveMonthlySummary: (request: SaveMonthlySummaryRequest) => Promise<MonthlySummary>;
  showMonthlySummaryFile: (summaryId: string) => Promise<boolean>;
  getQuarterlyWorkspace: (request?: GetQuarterlyWorkspaceRequest) => Promise<QuarterlyWorkspace>;
  generateQuarterlySummary: (request: GenerateQuarterlySummaryRequest) => Promise<QuarterlySummaryDraft>;
  saveQuarterlySummary: (request: SaveQuarterlySummaryRequest) => Promise<QuarterlySummary>;
  showQuarterlySummaryFile: (summaryId: string) => Promise<boolean>;
  getSemesterWorkspace: (request?: GetSemesterWorkspaceRequest) => Promise<SemesterWorkspace>;
  generateSemesterSummary: (request: GenerateSemesterSummaryRequest) => Promise<SemesterSummaryDraft>;
  saveSemesterSummary: (request: SaveSemesterSummaryRequest) => Promise<SemesterSummary>;
  showSemesterSummaryFile: (summaryId: string) => Promise<boolean>;
  getAnnualWorkspace: (request?: GetAnnualWorkspaceRequest) => Promise<AnnualWorkspace>;
  generateAnnualSummary: (request: GenerateAnnualSummaryRequest) => Promise<AnnualSummaryDraft>;
  saveAnnualSummary: (request: SaveAnnualSummaryRequest) => Promise<AnnualSummary>;
  showAnnualSummaryFile: (summaryId: string) => Promise<boolean>;
  getProjectWorkspace: (request?: GetProjectWorkspaceRequest) => Promise<ProjectWorkspace>;
  generateProjectSummary: (request: GenerateProjectSummaryRequest) => Promise<ProjectSummaryDraft>;
  saveProjectSummary: (request: SaveProjectSummaryRequest) => Promise<ProjectSummary>;
  showProjectSummaryFile: (summaryId: string) => Promise<boolean>;
  getKnowledgeState: () => Promise<KnowledgeState>;
  importKnowledgeFiles: (request: ImportKnowledgeRequest) => Promise<KnowledgeState>;
  removeKnowledgeSource: (sourceId: string) => Promise<KnowledgeState>;
  searchKnowledge: (request: KnowledgeSearchRequest) => Promise<KnowledgeSearchResponse>;
  generateRagConnection: (request: GenerateRagRequest) => Promise<RagDraft>;
  saveRagConnection: (request: SaveRagRequest) => Promise<SavedRagConnection>;
  listRagConnections: () => Promise<SavedRagConnection[]>;
  showKnowledgeSourceFile: (sourceId: string) => Promise<boolean>;
  showRagConnectionFile: (connectionId: string) => Promise<boolean>;
  getMarkdownDocument: (target: MarkdownDocumentTarget) => Promise<EditableMarkdownDocument>;
  saveMarkdownDocument: (request: SaveMarkdownDocumentRequest) => Promise<EditableMarkdownDocument>;
  showMarkdownDocumentFile: (target: MarkdownDocumentTarget) => Promise<boolean>;
  trashRecord: (recordId: string) => Promise<boolean>;
  restoreRecord: (recordId: string) => Promise<boolean>;
  showRecordFile: (recordId: string) => Promise<boolean>;
  getBackupState: () => Promise<BackupState>;
  createBackupNow: () => Promise<BackupSummary>;
  exportBackup: () => Promise<BackupSummary | null>;
  chooseBackupForRestore: () => Promise<BackupInspection | null>;
  restoreBackup: (request: RestoreBackupRequest) => Promise<RestoreBackupResult>;
  showBackupFolder: () => Promise<boolean>;
}
