import { z } from "zod";
import { randomBytes, randomInt } from "node:crypto";

export class LoginException extends Error {
  constructor(message?: string) {
    super(message ?? "Login failed");
    this.name = "LoginException";
  }
}

export class APIException extends Error {
  constructor(
    public readonly code: number,
    public readonly detail: Json,
  ) {
    super(`API error ${code}`);
    this.name = "APIException";
  }
}

export class ParseException extends Error {
  constructor(
    message: string,
    public readonly raw: Json,
  ) {
    super(message);
    this.name = "ParseException";
  }
}

export class MergeException extends Error {
  constructor(public readonly raw: JsonObject) {
    super("Merge conflict");
    this.name = "MergeException";
  }
}

export class ResyncRequiredException extends Error {
  constructor(message = "Full resync required") {
    super(message);
    this.name = "ResyncRequiredException";
  }
}

export class UpgradeRecommendedException extends Error {
  constructor(message = "Upgrade recommended") {
    super(message);
    this.name = "UpgradeRecommendedException";
  }
}

const AUTH_URL = "https://android.clients.google.com/auth";

const AUTH_USER_AGENT = "GoogleAuth/1.4";

const CLIENT_SIG = "38918a453d07199354f8b19af05ec6562ced5788";

const OAUTH_SCOPES =
  "oauth2:https://www.googleapis.com/auth/memento https://www.googleapis.com/auth/reminders";

export interface KeepTransportOptions {
  fetch?: typeof fetch;
  authUrl?: string;
  apiUrl?: string;
  mediaUrl?: string;
  fetchTimeoutMs?: number;
}

export const KEEP_FETCH_TIMEOUT_MS = 30_000;

type AuthResponse = Map<string, string>;

function parseAuthResponse(text: string): AuthResponse {
  const response = new Map<string, string>();

  for (const line of text.split("\n")) {
    const eq = line.indexOf("=");

    if (eq > 0) response.set(line.slice(0, eq), line.slice(eq + 1));
  }

  return response;
}

const AuthRequestSchema = z.object({
  accountType: z.string(),
  Email: z.string(),
  has_permission: z.number(),
  EncryptedPasswd: z.string(),
  service: z.string(),
  source: z.string(),
  androidId: z.string(),
  app: z.string(),
  client_sig: z.string(),
  device_country: z.string(),
  operatorCountry: z.string(),
  lang: z.string(),
  sdk_version: z.number(),
  google_play_services_version: z.number(),
});

type AuthRequest = z.infer<typeof AuthRequestSchema>;

function authForm(data: AuthRequest): URLSearchParams {
  const form = new URLSearchParams();

  for (const [key, value] of Object.entries(data)) {
    form.set(key, String(value));
  }

  return form;
}

const AUTH_RETRY_CNT = 2;

async function performAuthRequest(
  data: AuthRequest,
  fetchImpl: typeof fetch,
  authUrl: string,
): Promise<AuthResponse> {
  const form = authForm(data).toString();

  for (let attempt = 0; ; attempt += 1) {
    let resp: Response;

    try {
      resp = await fetchImpl(authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": AUTH_USER_AGENT,
        },
        body: form,
      });
    } catch (error) {
      if (attempt >= AUTH_RETRY_CNT) throw error;

      await Bun.sleep(1_000 * 2 ** attempt);
      continue;
    }

    if (resp.ok) return parseAuthResponse(await resp.text());

    if (resp.status < 500 || attempt >= AUTH_RETRY_CNT) {
      throw new LoginException(`auth HTTP ${resp.status}`);
    }

    await Bun.sleep(1_000 * 2 ** attempt);
  }
}

async function performOAuth(
  email: string,
  masterToken: string,
  androidId: string,
  service: string,
  fetchImpl: typeof fetch,
  authUrl: string,
): Promise<AuthResponse> {
  return performAuthRequest(
    {
      accountType: "HOSTED_OR_GOOGLE",
      Email: email,
      has_permission: 1,
      EncryptedPasswd: masterToken,
      service,
      source: "android",
      androidId,
      app: "com.google.android.keep",
      client_sig: CLIENT_SIG,
      device_country: "us",
      operatorCountry: "us",
      lang: "en",
      sdk_version: 17,
      google_play_services_version: 240913000,
    },
    fetchImpl,
    authUrl,
  );
}

const RETRY_CNT = 2;

async function apiSend(
  auth: APIAuth,
  url: string,
  method: string,
  json: Json | undefined,
  fetchImpl: typeof fetch,
): Promise<Json> {
  let delay = 2;

  for (let attempt = 0; ; attempt += 1) {
    const response = await apiSendOnce(auth, url, method, json, fetchImpl);

    if (!isJsonObject(response) || !("error" in response)) {
      return response;
    }

    const error = response.error;
    const errorObject = JsonObjectSchema.safeParse(error);

    const code = errorObject.success ? (jsonNumber(errorObject.data.code) ?? 0) : 0;

    if (code === 429) {
      if (attempt >= RETRY_CNT) throw new APIException(429, error);

      await Bun.sleep(delay * 1000);
      delay = Math.min(delay * 2, 60);
      continue;
    }

    if (code !== 401 || attempt >= RETRY_CNT) {
      throw new APIException(code, error);
    }

    await auth.refresh();
  }
}

async function apiSendOnce(
  auth: APIAuth,
  url: string,
  method: string,
  json: Json | undefined,
  fetchImpl: typeof fetch,
): Promise<Json> {
  const token = auth.getAuthToken();

  if (token === null) throw new LoginException("Not logged in");

  const resp = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `OAuth ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "x-gkeepapi/0.17.1 (https://github.com/kiwiz/gkeepapi)",
    },
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  if (!resp.ok) throw new APIException(resp.status, await resp.text());

  return JsonSchema.parse(JSON.parse(await resp.text()));
}

const JsonSchema = z.json();

type Json = z.infer<typeof JsonSchema>;

const JsonObjectSchema = z.record(z.string(), JsonSchema);

type JsonObject = z.infer<typeof JsonObjectSchema>;

const KeepTimestampsSchema = z
  .object({
    kind: z.string().optional(),
    created: z.string(),
    updated: z.string(),
    deleted: z.string().nullable().optional(),
    trashed: z.string().nullable().optional(),
    userEdited: z.string().nullable().optional(),
  })
  .catchall(JsonSchema);

const WireInt = z.union([
  z.number(),
  z
    .string()
    .regex(/^-?\d+$/)
    .transform(Number),
]);

const KeepNodeFields = {
  id: z.string(),
  serverId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortValue: WireInt.optional(),
  baseVersion: WireInt.nullable().optional(),
  text: z.string().optional(),
  timestamps: KeepTimestampsSchema,
};

const KeepNodeWireSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...KeepNodeFields,
      type: z.literal("NOTE"),
      title: z.string().optional(),
      isArchived: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    })
    .catchall(JsonSchema),
  z
    .object({
      ...KeepNodeFields,
      type: z.literal("LIST"),
      title: z.string().optional(),
      isArchived: z.boolean().optional(),
      isPinned: z.boolean().optional(),
    })
    .catchall(JsonSchema),
  z
    .object({
      ...KeepNodeFields,
      type: z.literal("LIST_ITEM"),
      checked: z.boolean().optional(),
      parentServerId: z.string().nullable().optional(),
      superListItemId: z.string().nullable().optional(),
    })
    .catchall(JsonSchema),
  z
    .object({
      ...KeepNodeFields,
      type: z.literal("BLOB"),
      blob: z.object({ type: z.string() }).catchall(JsonSchema),
    })
    .catchall(JsonSchema),
]);

function isJsonObject(value: Json): value is JsonObject {
  return JsonObjectSchema.safeParse(value).success;
}

function isJsonArray(value: Json): value is Json[] {
  return z.array(JsonSchema).safeParse(value).success;
}

function jsonString(value: Json): string | undefined {
  const result = z.string().safeParse(value);

  return result.success ? result.data : undefined;
}

function jsonNumber(value: Json): number | undefined {
  const result = z.number().safeParse(value);

  return result.success ? result.data : undefined;
}

export class APIAuth {
  private authToken: string | null = null;

  constructor(
    private readonly email: string,
    private readonly masterToken: string,
    private readonly deviceId: string,
    private readonly scopes: string = OAUTH_SCOPES,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly authUrl: string = AUTH_URL,
  ) {}

  async refresh(): Promise<string> {
    const res = await performOAuth(
      this.email,
      this.masterToken,
      this.deviceId,
      this.scopes,
      this.fetchImpl,
      this.authUrl,
    );

    const auth = res.get("Auth") ?? res.get("Token");

    if (auth === undefined) throw new LoginException(res.get("Error"));
    this.authToken = auth;

    return auth;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }
}

const KEEP_API_URL = "https://www.googleapis.com/notes/v1/";

const CLIENT_CAPABILITIES: JsonObject[] = [
  { type: "NC" },
  { type: "PI" },
  { type: "LB" },
  { type: "AN" },
  { type: "SH" },
  { type: "DR" },
  { type: "TR" },
  { type: "IN" },
  { type: "SNB" },
  { type: "MI" },
  { type: "CO" },
];

function intToStr(tz: number): string {
  return dtToStr(new Date(tz * 1000));
}

function dtToStr(date: Date): string {
  return `${date.toISOString().slice(0, 23)}000Z`;
}

function strToDt(tzs: Json): Date {
  if (tzs === null || tzs === undefined) return new Date(0);
  const text = jsonString(tzs);

  if (text === undefined) {
    throw new ParseException("timestamp is not a string", tzs);
  }

  const parsed = Date.parse(`${text}Z`.replace("ZZ", "+00:00"));

  if (Number.isNaN(parsed)) {
    throw new ParseException("malformed timestamp", tzs);
  }

  return new Date(parsed);
}

const SyncResponseSchema = z
  .object({
    nodes: z.array(JsonSchema).default([]),
    userInfo: JsonObjectSchema.nullable().default(null),
    toVersion: z.string().nullable().default(null),
    truncated: z.boolean().default(false),
    forceFullResync: z.boolean().default(false),
    upgradeRecommended: z.boolean().default(false),
  })
  .catchall(JsonSchema);

type SyncResponse = z.infer<typeof SyncResponseSchema>;

function decodeSyncResponse(raw: Json): SyncResponse {
  return SyncResponseSchema.parse(raw);
}

async function keepChanges(
  auth: APIAuth,
  sessionId: string,
  targetVersion: string | null,
  nodes: JsonObject[],
  apiUrl: string,
  fetchImpl: typeof fetch,
): Promise<SyncResponse> {
  const params: JsonObject = {
    nodes,
    clientTimestamp: intToStr(Date.now() / 1000),
    requestHeader: {
      clientSessionId: sessionId,
      clientPlatform: "ANDROID",
      clientVersion: { major: "9", minor: "9", build: "9", revision: "9" },
      capabilities: CLIENT_CAPABILITIES,
    },
  };

  if (targetVersion !== null) {
    params.targetVersion = targetVersion;
  }

  const response = await apiSend(auth, `${apiUrl}changes`, "POST", params, fetchImpl);

  return decodeSyncResponse(response);
}

const KEEP_MEDIA_URL = "https://keep.google.com/media/v2/";

async function mediaGet(
  auth: APIAuth,
  blob: KeepBlob,
  mediaUrl: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const parentServerId = blob.parent?.serverId;

  if (parentServerId === null || parentServerId === undefined || blob.serverId === null) {
    throw new APIException(0, "blob has no server identity");
  }

  const url = `${mediaUrl}${parentServerId}/${blob.serverId}`;
  const token = auth.getAuthToken();

  if (token === null) throw new LoginException("Not logged in");

  const resp = await fetchImpl(url, {
    headers: { Authorization: `OAuth ${token}` },
    redirect: "manual",
  });

  const location = resp.headers.get("location");

  if (location === null) {
    throw new APIException(resp.status, "no media link");
  }

  return location;
}

class NodeTimestamps {
  private wire: JsonObject = {};
  private _trashed: Date | null = null;
  constructor(
    public created: Date,
    public deleted: Date | null,
    public updated: Date,
    public edited: Date,
  ) {}

  get trashed(): Date | null {
    return this._trashed;
  }

  set trashed(value: Date | null) {
    this._trashed = value;
    this.dirty = true;
  }

  dirty = false;

  load(raw: JsonObject): void {
    this.wire = raw;
    this.created = strToDt(raw.created);
    this.deleted = "deleted" in raw ? strToDt(raw.deleted) : null;
    this._trashed = "trashed" in raw ? strToDt(raw.trashed) : null;
    this.updated = strToDt(raw.updated);
    this.edited = "userEdited" in raw ? strToDt(raw.userEdited) : new Date(0);
    this.dirty = false;
  }

  save(clean = true): JsonObject {
    const ret: JsonObject = {
      ...this.wire,
      kind: "notes#timestamps",
      created: dtToStr(this.created),
      updated: dtToStr(this.updated),
    };

    if (this.deleted !== null) ret.deleted = dtToStr(this.deleted);

    if (this._trashed !== null) ret.trashed = dtToStr(this._trashed);

    if (this.edited.getTime() !== 0) ret.userEdited = dtToStr(this.edited);

    if (clean) {
      this.dirty = false;
    }

    return ret;
  }
}

abstract class KeepNode {
  protected wire: JsonObject = {};
  parent: KeepNode | null = null;
  moved = false;
  protected dirty = false;

  constructor(
    public id: string,
    public parentId: string | null,
  ) {}

  serverId: string | null = null;
  sort = randomInt(1_000_000_000, 10_000_000_000);
  version: number | null = null;
  protected nodeText = "";
  get text(): string {
    return this.nodeText;
  }

  set text(value: string) {
    this.nodeText = value;
  }
  timestamps = new NodeTimestamps(new Date(), null, new Date(), new Date());

  private children = new Map<string, KeepNode>();

  get isNew(): boolean {
    return this.serverId === null;
  }

  get childNodes(): KeepNode[] {
    return [...this.children.values()];
  }

  getChild(nodeId: string): KeepNode | undefined {
    return this.children.get(nodeId);
  }

  append(node: KeepNode, dirty = true): KeepNode {
    this.children.set(node.id, node);
    node.parent = this;

    if (dirty) this.touch();

    return node;
  }

  remove(node: KeepNode, dirty = true): void {
    const existing = this.children.get(node.id);

    if (existing !== undefined) {
      existing.parent = null;
      this.children.delete(node.id);
    }

    if (dirty) this.touch();
  }

  touch(edited = false): void {
    this.dirty = true;
    const now = new Date();
    this.timestamps.updated = now;

    if (edited) this.timestamps.edited = now;
  }

  load(raw: JsonObject): void {
    if ("mergeConflict" in raw) throw new MergeException(raw);
    const wire = KeepNodeWireSchema.parse(raw);
    this.wire = wire;
    this.id = wire.id;
    this.serverId = wire.serverId ?? null;
    this.parentId = wire.parentId ?? null;
    this.sort = wire.sortValue ?? this.sort;
    this.version = wire.baseVersion ?? null;
    this.nodeText = wire.text ?? "";
    this.timestamps.load(wire.timestamps);
    this.moved = "moved" in wire;
    this.dirty = wire._dirty === true;
  }

  save(clean = true): JsonObject {
    const ret: JsonObject = { ...this.wire };
    ret.id = this.id;
    ret.parentId = this.parentId;
    ret.sortValue = this.sort;

    if (!this.moved && this.version !== null) {
      ret.baseVersion = this.version;
    }

    ret.text = this.text;

    if (this.serverId !== null) {
      ret.serverId = this.serverId;
    }

    ret.timestamps = this.timestamps.save(clean);

    if (clean) {
      this.dirty = false;
    } else {
      ret._dirty = this.dirty;
    }

    return ret;
  }

  get isDirty(): boolean {
    return this.dirty || this.timestamps.dirty || this.childNodes.some((child) => child.isDirty);
  }

  get deleted(): boolean {
    return this.timestamps.deleted !== null && this.timestamps.deleted.getTime() > 0;
  }

  abstract readonly nodeType: string;
}

class KeepRoot extends KeepNode {
  static readonly ID = "root";

  readonly nodeType = "";

  constructor() {
    super(KeepRoot.ID, null);
  }

  override get isDirty(): boolean {
    return false;
  }
}

abstract class TopLevelNode extends KeepNode {
  archived = false;
  pinned = false;
  title = "";

  protected constructor(
    id: string,
    readonly nodeType: string,
  ) {
    super(id, KeepRoot.ID);
  }

  override load(raw: JsonObject): void {
    super.load(raw);
    this.archived = raw.isArchived === true;
    this.pinned = raw.isPinned === true;
    this.title = jsonString(raw.title) ?? "";
  }

  override save(clean = true): JsonObject {
    const ret = super.save(clean);
    ret.isArchived = this.archived;
    ret.isPinned = this.pinned;
    ret.title = this.title;

    return ret;
  }

  get trashed(): boolean {
    return this.timestamps.trashed !== null && this.timestamps.trashed.getTime() > 0;
  }

  trash(): void {
    this.timestamps.trashed = new Date();
  }

  get blobs(): KeepBlob[] {
    return this.childNodes.filter((child): child is KeepBlob => child instanceof KeepBlob);
  }

  get hasUnchecked(): boolean {
    return (
      this.nodeType === "LIST" &&
      this.childNodes.some((child) => child instanceof ListItem && !child.deleted && !child.checked)
    );
  }

  get images(): KeepBlob[] {
    return this.blobs.filter((blob) => blob.blobType === "IMAGE");
  }
}

class ListItem extends KeepNode {
  superListItemId: string | null = null;
  prevSuperListItemId: string | null = null;
  parentServerId: string | null = null;
  checked = false;
  parentItem: ListItem | null = null;
  private subitems = new Map<string, ListItem>();

  readonly nodeType = "LIST_ITEM";

  constructor(parentId: string | null = null) {
    super(generateNodeId(), parentId);
  }

  override load(raw: JsonObject): void {
    super.load(raw);
    this.prevSuperListItemId = this.superListItemId;
    this.superListItemId = jsonString(raw.superListItemId) ?? null;
    this.parentServerId = jsonString(raw.parentServerId) ?? null;
    this.checked = raw.checked === true;
  }

  override save(clean = true): JsonObject {
    const ret = super.save(clean);
    ret.parentServerId = this.parentServerId;
    ret.superListItemId = this.superListItemId;
    ret.checked = this.checked;

    return ret;
  }

  indent(node: ListItem, dirty = true): void {
    if (node.subitems.size > 0) return;
    this.subitems.set(node.id, node);
    node.superListItemId = this.id;
    node.parentItem = this;

    if (dirty) node.touch(true);
  }

  dedent(node: ListItem, dirty = true): void {
    if (!this.subitems.delete(node.id)) return;
    node.superListItemId = null;
    node.parentItem = null;

    if (dirty) node.touch(true);
  }

  get subItems(): ListItem[] {
    return KeepList.sortedItems([...this.subitems.values()]);
  }

  get indented(): boolean {
    return this.parentItem !== null;
  }

  toString(): string {
    return `${this.indented ? "  " : ""}${this.checked ? "☑" : "☐"} ${this.text}`;
  }
}

class KeepNote extends TopLevelNode {
  readonly nodeType = "NOTE";

  constructor(id: string = generateNodeId()) {
    super(id, "NOTE");
  }

  private get textNode(): ListItem | undefined {
    return this.childNodes.find((child): child is ListItem => child instanceof ListItem);
  }

  override get text(): string {
    const node = this.textNode;

    return node === undefined ? super.text : node.text;
  }

  override set text(value: string) {
    const node = this.textNode ?? new ListItem(this.id);

    if (this.textNode === undefined) this.append(node, true);
    node.text = value;
    this.touch(true);
  }
}

class KeepList extends TopLevelNode {
  static readonly SORT_DELTA = 10000;

  readonly nodeType = "LIST";

  constructor(id: string = generateNodeId()) {
    super(id, "LIST");
  }

  private get items(): ListItem[] {
    return KeepList.sortedItems(
      this.childNodes.filter(
        (child): child is ListItem => child instanceof ListItem && !child.deleted,
      ),
    );
  }

  override get text(): string {
    return this.items.map((item) => `${item}`).join("\n");
  }

  static sortedItems(items: ListItem[]): ListItem[] {
    return [...items].sort((a, b) => {
      const aKey = a.indented && a.parentItem !== null ? [a.parentItem.sort, a.sort] : [a.sort];

      const bKey = b.indented && b.parentItem !== null ? [b.parentItem.sort, b.sort] : [b.sort];

      for (let i = 0; i < Math.max(aKey.length, bKey.length); i += 1) {
        const av = aKey[i];
        const bv = bKey[i];

        if (av === undefined) return 1;

        if (bv === undefined) return -1;

        if (av !== bv) return bv - av;
      }

      return 0;
    });
  }
  override set text(value: string) {
    super.text = value;
  }
}

function generateNodeId(): string {
  return `${Math.floor(Date.now()).toString(16)}.${randomBytes(8).toString("hex")}`;
}

export class KeepBlob extends KeepNode {
  readonly nodeType = "BLOB";

  blobType: string | null = null;

  constructor(parentId: string | null = null) {
    super(generateNodeId(), parentId);
  }

  override load(raw: JsonObject): void {
    super.load(raw);
    const inner = raw.blob;
    this.blobType = isJsonObject(inner) ? (jsonString(inner.type) ?? null) : null;
  }

  override save(clean = true): JsonObject {
    const ret = super.save(clean);

    if (this.blobType !== null) {
      const blob: JsonObject = {};

      if (isJsonObject(this.wire.blob)) Object.assign(blob, this.wire.blob);
      blob.type = this.blobType;
      ret.blob = blob;
    }

    return ret;
  }
}

export type KeepImage = Pick<KeepBlob, "id">;

function nodeFromJson(raw: JsonObject): KeepNode | null {
  const type = jsonString(raw.type);

  if (type === "NOTE") return new KeepNote();

  if (type === "LIST") return new KeepList();

  if (type === "LIST_ITEM") return new ListItem();

  if (type === "BLOB") return new KeepBlob();

  return null;
}

export const KeepStateSchema = z
  .object({
    keep_version: z.string().nullable(),
    labels: z.array(JsonObjectSchema),
    nodes: z.array(JsonObjectSchema),
  })
  .strict();

export type KeepState = z.infer<typeof KeepStateSchema>;

export class Keep {
  private readonly auth: APIAuth;
  private readonly sessionId: string;
  private keepVersion: string | null = null;
  private readonly nodes = new Map<string, KeepNode>();
  private readonly sidMap = new Map<string, string>();
  private labelWire: JsonObject[] = [];
  private readonly fetchImpl: typeof fetch;
  private readonly apiUrl: string;
  private readonly mediaUrl: string;
  constructor(
    email: string,
    masterToken: string,
    deviceId?: string,
    options: KeepTransportOptions = {},
  ) {
    const fetchImpl = options.fetch ?? fetch;
    const fetchTimeoutMs = options.fetchTimeoutMs ?? KEEP_FETCH_TIMEOUT_MS;

    const withTimeout: typeof fetch = Object.assign(
      (input: string | Request | URL, init?: RequestInit) =>
        fetchImpl(
          input,
          init?.signal ? init : { ...init, signal: AbortSignal.timeout(fetchTimeoutMs) },
        ),
      { preconnect: fetchImpl.preconnect },
    );

    this.apiUrl = options.apiUrl ?? KEEP_API_URL;
    this.mediaUrl = options.mediaUrl ?? KEEP_MEDIA_URL;
    this.auth = new APIAuth(
      email,
      masterToken,
      deviceId ?? randomBytes(8).toString("hex"),
      OAUTH_SCOPES,
      withTimeout,
      options.authUrl ?? AUTH_URL,
    );
    this.fetchImpl = withTimeout;
    this.sessionId = `s--${Math.floor(Date.now() / 1000)}--${randomInt(1_000_000_000, 10_000_000_000)}`;
    this.nodes.set(KeepRoot.ID, new KeepRoot());
  }

  async authenticate(state: KeepState | null = null, sync = true): Promise<void> {
    await this.auth.refresh();

    if (state !== null) {
      this.restore(state);
    }

    if (sync) {
      await this.sync();
    }
  }

  dump(): KeepState {
    const nodes: JsonObject[] = [];

    for (const node of this.all()) {
      nodes.push(node.save(false));

      for (const child of node.childNodes) {
        nodes.push(child.save(false));
      }
    }

    return {
      keep_version: this.keepVersion,
      labels: this.labelWire.map((label) => ({ ...label })),
      nodes,
    };
  }

  restore(state: KeepState): void {
    this.nodes.clear();
    this.sidMap.clear();
    this.nodes.set(KeepRoot.ID, new KeepRoot());
    this.labelWire = state.labels.map((label) => ({ ...label }));
    this.parseNodes(state.nodes);
    this.keepVersion = state.keep_version;
  }

  all(): TopLevelNode[] {
    const root = this.nodes.get(KeepRoot.ID);

    if (root === undefined) return [];

    return root.childNodes.filter((child): child is TopLevelNode => child instanceof TopLevelNode);
  }

  async getMediaLink(image: KeepImage): Promise<string> {
    const blob = this.nodes.get(image.id);

    if (!(blob instanceof KeepBlob)) {
      throw new APIException(0, "image blob is not in the synchronized node tree");
    }

    return mediaGet(this.auth, blob, this.mediaUrl, this.fetchImpl);
  }

  async sync(): Promise<void> {
    for (;;) {
      const changes = await keepChanges(
        this.auth,
        this.sessionId,
        this.keepVersion,
        this.findDirtyNodes().map((node) => node.save()),
        this.apiUrl,
        this.fetchImpl,
      );

      if (changes.forceFullResync) throw new ResyncRequiredException();

      if (changes.upgradeRecommended) throw new UpgradeRecommendedException();

      if (changes.userInfo !== null) this.parseUserInfo(changes.userInfo);

      if (changes.nodes.length > 0) this.parseNodes(changes.nodes);
      this.keepVersion = changes.toVersion;

      if (!changes.truncated) return;
    }
  }

  private findDirtyNodes(): KeepNode[] {
    for (const node of this.nodes.values()) {
      for (const child of node.childNodes) {
        if (!this.nodes.has(child.id)) {
          this.nodes.set(child.id, child);
        }
      }
    }

    return [...this.nodes.values()].filter((node) => node.isDirty);
  }

  private parseUserInfo(raw: JsonObject): void {
    const list = isJsonArray(raw.labels) ? raw.labels : [];
    this.labelWire = list.filter(isJsonObject);
  }

  private parseNodes(raw: Json[]): void {
    const createdNodes: KeepNode[] = [];
    const deletedNodes: KeepNode[] = [];
    const listItemNodes: ListItem[] = [];

    for (const entry of raw) {
      if (!isJsonObject(entry)) continue;
      const nodeId = jsonString(entry.id);

      if (nodeId === undefined) continue;
      const existing = this.nodes.get(nodeId);
      let node: KeepNode | undefined = existing;

      if (node !== undefined) {
        if ("parentId" in entry) {
          node.load(entry);

          if (node.serverId !== null) {
            this.sidMap.set(node.serverId, node.id);
          }
        } else {
          deletedNodes.push(node);
        }
      } else {
        const created = nodeFromJson(entry);

        if (created === null) continue;
        node = created;
        node.load(entry);
        this.nodes.set(node.id, node);

        if (node.serverId !== null) {
          this.sidMap.set(node.serverId, node.id);
        }

        createdNodes.push(node);
      }

      if (node instanceof ListItem) {
        listItemNodes.push(node);
      }
    }

    for (const node of listItemNodes) {
      const prev = node.prevSuperListItemId;
      const curr = node.superListItemId;

      if (prev === curr) continue;

      if (prev !== null) {
        const oldParent = this.nodes.get(prev);

        if (oldParent instanceof ListItem) oldParent.dedent(node, false);
      }

      if (curr !== null) {
        const newParent = this.nodes.get(curr);

        if (newParent instanceof ListItem) newParent.indent(node, false);
      }
    }

    for (const node of createdNodes) {
      const parent = node.parentId === null ? undefined : this.nodes.get(node.parentId);
      parent?.append(node, false);
    }

    for (const node of deletedNodes) {
      node.parent?.remove(node, false);
      this.nodes.delete(node.id);

      if (node.serverId !== null) {
        this.sidMap.delete(node.serverId);
      }
    }
  }
}
