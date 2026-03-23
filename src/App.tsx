import { useState, useEffect, useRef } from 'react';
import { AgentBrain } from './agent/brain';
import { parseAgentMessage } from './utils/parseAgentMessage';

interface Message {
	role: 'user' | 'agent' | 'system';
	content: string;
}

interface PromptTemplate {
	id: string;
	name: string;
	content: string;
}

interface AttachedFile {
	id: string;
	name: string;
	type: string;
	size: number;
	textContent?: string;
	dataUrl?: string;
}

interface AssetFile {
	id: string;
	name: string;
	type: string;
	size: number;
	dataUrl: string;
}
const App = () => {
	const [task, setTask] = useState('');
	const [messages, setMessages] = useState<Message[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [interactionMode, setInteractionMode] = useState<'agent' | 'ask'>(
		() =>
			localStorage.getItem('agent_interaction_mode') === 'ask'
				? 'ask'
				: 'agent'
	);

	// Settings State
	const [baseUrl, setBaseUrl] = useState(
		() => localStorage.getItem('agent_base_url') || 'http://localhost:11434/v1'
	);
	const [apiKey, setApiKey] = useState(
		() => localStorage.getItem('agent_api_key') || ''
	);
	const [modelName, setModelName] = useState(
		() => localStorage.getItem('agent_model') || 'gpt-3.5-turbo'
	);
	const [availableModels, setAvailableModels] = useState<string[]>([]);
	const [useManualModel, setUseManualModel] = useState(false);
	const [supportsVision, setSupportsVision] = useState(
		() => localStorage.getItem('agent_supports_vision') === 'true'
	);
	const [maxSteps, setMaxSteps] = useState(
		() => Number(localStorage.getItem('agent_max_steps') || '30') || 30
	);
	const [requestTimeoutMs, setRequestTimeoutMs] = useState(
		() =>
			Number(localStorage.getItem('agent_request_timeout_ms') || '900000') ||
			900000
	);
	const [stepDelayMs, setStepDelayMs] = useState(
		() => Number(localStorage.getItem('agent_step_delay_ms') || '1500') || 1500
	);
	const [invalidRetryBaseMs, setInvalidRetryBaseMs] = useState(
		() =>
			Number(localStorage.getItem('agent_invalid_retry_base_ms') || '500') ||
			500
	);
	const [invalidRetryIncrementMs, setInvalidRetryIncrementMs] = useState(
		() =>
			Number(localStorage.getItem('agent_invalid_retry_increment_ms') || '500') ||
			500
	);
	const [invalidRetryMaxMs, setInvalidRetryMaxMs] = useState(
		() =>
			Number(localStorage.getItem('agent_invalid_retry_max_ms') || '5000') ||
			5000
	);
	const [templates, setTemplates] = useState<PromptTemplate[]>(() => {
		try {
			const raw = localStorage.getItem('agent_prompt_templates');
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	});
	const [activeTemplateId, setActiveTemplateId] = useState(
		() => localStorage.getItem('agent_active_template') || ''
	);
	const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
		null
	);
	const [templateName, setTemplateName] = useState('');
	const [templateContent, setTemplateContent] = useState('');
	const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
	const [assets, setAssets] = useState<AssetFile[]>([]);
	const [sessionLoaded, setSessionLoaded] = useState(false);
	const [showTemplatePanel, setShowTemplatePanel] = useState(false);
	const [showHistoryPanel, setShowHistoryPanel] = useState(false);
	const [isDark, setIsDark] = useState(true);
	const [showTemplateForm, setShowTemplateForm] = useState(false);
	const [openTemplateMenuId, setOpenTemplateMenuId] = useState<string | null>(
		null
	);
	const [showAssetSuggestions, setShowAssetSuggestions] = useState(false);
	const [assetQuery, setAssetQuery] = useState('');

	const bottomRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef(true);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	useEffect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const update = () => setIsDark(media.matches);
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	}, []);

	useEffect(() => {
		try {
			const raw = localStorage.getItem('agent_session_messages');
			if (raw) {
				setMessages(JSON.parse(raw));
			} else {
				setMessages([
					{
						role: 'system',
						content: 'Standalone Agent Ready. Configure settings first.',
					},
				]);
			}
		} catch {
			setMessages([
				{
					role: 'system',
					content: 'Standalone Agent Ready. Configure settings first.',
				},
			]);
		} finally {
			setSessionLoaded(true);
		}
	}, []);

	useEffect(() => {
		if (!sessionLoaded) return;
		const snapshot = messages.slice(-200);
		localStorage.setItem('agent_session_messages', JSON.stringify(snapshot));
	}, [messages, sessionLoaded]);

	useEffect(() => {
		localStorage.setItem('agent_prompt_templates', JSON.stringify(templates));
	}, [templates]);

	useEffect(() => {
		localStorage.setItem('agent_active_template', activeTemplateId);
	}, [activeTemplateId]);

	useEffect(() => {
		localStorage.setItem('agent_interaction_mode', interactionMode);
	}, [interactionMode]);

	// Save settings
	const saveSettings = () => {
		localStorage.setItem('agent_base_url', baseUrl);
		localStorage.setItem('agent_api_key', apiKey);
		localStorage.setItem('agent_model', modelName);
		localStorage.setItem('agent_supports_vision', String(supportsVision));
		localStorage.setItem(
			'agent_max_steps',
			String(Math.max(1, Math.floor(maxSteps)))
		);
		localStorage.setItem(
			'agent_request_timeout_ms',
			String(Math.max(1000, Math.floor(requestTimeoutMs)))
		);
		localStorage.setItem(
			'agent_step_delay_ms',
			String(Math.max(0, Math.floor(stepDelayMs)))
		);
		localStorage.setItem(
			'agent_invalid_retry_base_ms',
			String(Math.max(0, Math.floor(invalidRetryBaseMs)))
		);
		localStorage.setItem(
			'agent_invalid_retry_increment_ms',
			String(Math.max(0, Math.floor(invalidRetryIncrementMs)))
		);
		localStorage.setItem(
			'agent_invalid_retry_max_ms',
			String(Math.max(0, Math.floor(invalidRetryMaxMs)))
		);
		localStorage.removeItem('agent_vision_base_url');
		localStorage.removeItem('agent_vision_api_key');
		localStorage.removeItem('agent_vision_model');
		setShowSettings(false);
		addMessage('system', `Settings Saved. Model: ${modelName}`);
	};

	const fetchModels = async () => {
		addMessage('system', 'Fetching models...');
		const models = await AgentBrain.fetchModels(baseUrl, apiKey);
		if (models.length > 0) {
			setAvailableModels(models);
			addMessage('system', `Found ${models.length} models.`);
		} else {
			addMessage('system', 'No models found or connection failed.');
		}
	};

	const clearSession = () => {
		setMessages([
			{
				role: 'system',
				content: 'Standalone Agent Ready. Configure settings first.',
			},
		]);
		localStorage.removeItem('agent_session_messages');
	};

	const saveTemplate = () => {
		const name = templateName.trim();
		const content = templateContent.trim();
		if (!name || !content) return;
		if (editingTemplateId) {
			setTemplates((prev) =>
				prev.map((t) =>
					t.id === editingTemplateId ? { ...t, name, content } : t
				)
			);
		} else {
			const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`;
			setTemplates((prev) => [...prev, { id, name, content }]);
			setActiveTemplateId(id);
		}
		setEditingTemplateId(null);
		setTemplateName('');
		setTemplateContent('');
		setShowTemplateForm(false);
	};

	const startEditTemplate = (id: string) => {
		const tpl = templates.find((t) => t.id === id);
		if (!tpl) return;
		setEditingTemplateId(tpl.id);
		setTemplateName(tpl.name);
		setTemplateContent(tpl.content);
		setShowTemplateForm(true);
	};

	const clearTemplateEditor = () => {
		setEditingTemplateId(null);
		setTemplateName('');
		setTemplateContent('');
		setShowTemplateForm(false);
	};

	const deleteTemplateById = (id: string) => {
		setTemplates((prev) => prev.filter((t) => t.id !== id));
		if (activeTemplateId === id) setActiveTemplateId('');
		if (editingTemplateId === id) clearTemplateEditor();
		setOpenTemplateMenuId(null);
	};

	const readFileAsText = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsText(file);
		});

	const readFileAsDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = () => reject(new Error('Failed to read file'));
			reader.readAsDataURL(file);
		});

	const addAssets = async (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return;
		const maxBytes = 8_000_000;
		const newItems: AssetFile[] = [];

		for (const file of Array.from(fileList)) {
			if (file.size > maxBytes) {
				addMessage('system', `Skipped ${file.name} (asset too large).`);
				continue;
			}
			const dataUrl = await readFileAsDataUrl(file);
			newItems.push({
				id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
				name: file.name,
				type: file.type || 'application/octet-stream',
				size: file.size,
				dataUrl,
			});
		}

		if (newItems.length > 0) {
			setAssets((prev) => [...prev, ...newItems]);
		}
	};

	const removeAsset = (id: string) => {
		setAssets((prev) => prev.filter((f) => f.id !== id));
	};

	const addFiles = async (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return;
		const maxTextBytes = 200_000;
		const maxImageBytes = 4_000_000;
		const newItems: AttachedFile[] = [];

		for (const file of Array.from(fileList)) {
			if (file.type.startsWith('image/')) {
				if (file.size > maxImageBytes) {
					addMessage('system', `Skipped ${file.name} (image too large).`);
					continue;
				}
				const dataUrl = await readFileAsDataUrl(file);
				newItems.push({
					id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
					name: file.name,
					type: file.type,
					size: file.size,
					dataUrl,
				});
			} else {
				if (file.size > maxTextBytes) {
					addMessage('system', `Skipped ${file.name} (file too large).`);
					continue;
				}
				const textContent = await readFileAsText(file);
				newItems.push({
					id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
					name: file.name,
					type: file.type || 'text/plain',
					size: file.size,
					textContent,
				});
			}
		}

		if (newItems.length > 0) {
			setAttachedFiles((prev) => [...prev, ...newItems]);
		}
	};

	const removeFile = (id: string) => {
		setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
	};

	const startNewChat = () => {
		clearSession();
		setTask('');
		setAttachedFiles([]);
	};

	const buildFileContext = () => {
		if (attachedFiles.length === 0) return '';
		return attachedFiles
			.map((file) => {
				if (file.dataUrl) {
					return `Image File: ${file.name} (included as visual input when vision is enabled)`;
				}
				const text = (file.textContent || '').slice(0, 4000);
				return `File: ${file.name}\n${text}`;
			})
			.join('\n\n');
	};

	const buildImageAttachments = () => {
		return attachedFiles
			.filter((file) => Boolean(file.dataUrl))
			.map((file) => ({
				name: file.name,
				dataUrl: file.dataUrl as string,
			}));
	};

	const buildAssetCatalog = () => {
		if (assets.length === 0) return '';
		return assets
			.map((a) => `${a.name} (${a.type}, ${a.size} bytes)`)
			.join('\n');
	};

	const hashString = (input: string) => {
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			hash = (hash << 5) - hash + input.charCodeAt(i);
			hash |= 0;
		}
		return hash.toString();
	};

	const tryParseJson = (raw: string) => {
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	};

	const repairJson = (raw: string) => {
		let cleaned = raw.trim();
		cleaned = cleaned.replace(/```json|```/gi, '');
		cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
		cleaned = cleaned.replace(/\/\/.*$/gm, '');
		cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
		cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
		cleaned = cleaned.replace(
			/'([^'\\]*(?:\\.[^'\\]*)*)'/g,
			(_m, s) => `"${String(s).replace(/"/g, '\\"')}"`
		);
		cleaned = cleaned.replace(/([,{]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
		return cleaned;
	};

	const parseAgentDecision = (raw: string) => {
		const candidates: string[] = [];
		const fenceMatches = raw.matchAll(/```json\s*([\s\S]*?)\s*```/gi);
		for (const match of fenceMatches) {
			if (match[1]) candidates.push(match[1]);
		}
		const firstBrace = raw.indexOf('{');
		const lastBrace = raw.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			candidates.push(raw.slice(firstBrace, lastBrace + 1));
		}
		candidates.push(raw);

		for (const candidate of candidates) {
			const direct = tryParseJson(candidate);
			if (direct?.action) return direct;
			const repaired = tryParseJson(repairJson(candidate));
			if (repaired?.action) return repaired;
		}
		return null;
	};

	const coerceDecisionShape = (decision: any) => {
		if (!decision || typeof decision !== 'object') return decision;
		const actionAliases: Record<string, string> = {
			INPUT: 'TYPE',
			FILL: 'TYPE',
			TYPE_TEXT: 'TYPE',
			PRESS_KEY: 'KEY',
			KEYPRESS: 'KEY',
			FINISH: 'DONE',
			COMPLETE: 'DONE',
			ANSWER: 'ASK',
			UPLOAD: 'UPLOAD_ASSET',
		};
		const rawAction = String(decision.action || '')
			.trim()
			.toUpperCase();
		const action = actionAliases[rawAction] || rawAction;
		const params =
			decision.params && typeof decision.params === 'object'
				? { ...decision.params }
				: {};
		const topLevelKeys = [
			'id',
			'label',
			'text',
			'value',
			'x',
			'y',
			'url',
			'key',
			'index',
			'ms',
			'question',
			'assetName',
			'summary',
			'target',
			'field',
		];
		topLevelKeys.forEach((key) => {
			if (params[key] == null && decision[key] != null) params[key] = decision[key];
		});
		if (params.label == null && typeof params.target === 'string') {
			params.label = params.target;
		}
		if (params.label == null && typeof params.field === 'string') {
			params.label = params.field;
		}
		if (params.text == null && params.value != null && action.startsWith('TYPE')) {
			params.text = params.value;
		}
		if (params.id != null) params.id = String(params.id);
		if (params.key == null && action === 'KEY') params.key = 'Enter';
		if (params.direction == null && action === 'SCROLL') params.direction = 'down';
		if (params.ms == null && action === 'WAIT') params.ms = 1000;
		return { action, params };
	};

	const normalizeDecision = (decision: any) => {
		const coerced = coerceDecisionShape(decision);
		if (!coerced || !coerced.action) return coerced;
		const params = coerced.params || {};
		if (coerced.action === 'CLICK' && params.id)
			return { ...coerced, action: 'CLICK_ID' };
		if (
			coerced.action === 'CLICK' &&
			typeof params.x === 'number' &&
			typeof params.y === 'number'
		) {
			return { ...coerced, action: 'CLICK_COORDS' };
		}
		if (coerced.action === 'TYPE' && params.id)
			return { ...coerced, action: 'TYPE_ID' };
		if (
			coerced.action === 'TYPE' &&
			typeof params.x === 'number' &&
			typeof params.y === 'number'
		) {
			return { ...coerced, action: 'TYPE_COORDS' };
		}
		if (coerced.action === 'HOVER' && params.id)
			return { ...coerced, action: 'HOVER_ID' };
		if (
			coerced.action === 'HOVER' &&
			typeof params.x === 'number' &&
			typeof params.y === 'number'
		) {
			return { ...coerced, action: 'HOVER_COORDS' };
		}
		if (coerced.action === 'SELECT' && params.id)
			return { ...coerced, action: 'SELECT_ID' };
		return coerced;
	};

	const validateActionPayload = (decision: any) => {
		if (!decision?.action) return 'Missing action';
		const params = decision.params ?? {};
		const hasId = typeof params.id === 'string' && params.id.trim().length > 0;
		const hasLabel =
			typeof params.label === 'string' && params.label.trim().length > 0;
		const hasText =
			typeof params.text === 'string' || typeof params.text === 'number';
		const hasValue =
			typeof params.value === 'string' || typeof params.value === 'number';
		const hasCoords =
			typeof params.x === 'number' && typeof params.y === 'number';

		switch (decision.action) {
			case 'CLICK':
				return hasLabel ? '' : 'CLICK requires params.label';
			case 'CLICK_ID':
				return hasId ? '' : 'CLICK_ID requires params.id';
			case 'CLICK_COORDS':
				return hasCoords ? '' : 'CLICK_COORDS requires params.x and params.y';
			case 'TYPE':
				return hasLabel && hasText
					? ''
					: 'TYPE requires params.label and params.text';
			case 'TYPE_ID':
				return hasId && hasText ? '' : 'TYPE_ID requires params.id and params.text';
			case 'TYPE_COORDS':
				return hasCoords && hasText
					? ''
					: 'TYPE_COORDS requires params.x, params.y and params.text';
			case 'HOVER':
				return hasLabel ? '' : 'HOVER requires params.label';
			case 'HOVER_ID':
				return hasId ? '' : 'HOVER_ID requires params.id';
			case 'HOVER_COORDS':
				return hasCoords ? '' : 'HOVER_COORDS requires params.x and params.y';
			case 'SELECT':
				return hasLabel && hasValue
					? ''
					: 'SELECT requires params.label and params.value';
			case 'SELECT_ID':
				return hasId && hasValue
					? ''
					: 'SELECT_ID requires params.id and params.value';
			case 'UPLOAD_ASSET':
				return typeof params.assetName === 'string' && params.assetName.trim()
					? ''
					: 'UPLOAD_ASSET requires params.assetName';
			case 'KEY':
				return typeof params.key === 'string' && params.key.trim()
					? ''
					: 'KEY requires params.key';
			case 'NAVIGATE':
				return typeof params.url === 'string' && params.url.trim()
					? ''
					: 'NAVIGATE requires params.url';
			case 'WAIT':
				return '';
			case 'ASK':
				return typeof params.question === 'string' && params.question.trim()
					? ''
					: 'ASK requires params.question';
			default:
				return '';
		}
	};

	const buildElementMapSummary = (elements: any[]) => {
		if (!Array.isArray(elements)) return '';
		const limited = elements.slice(0, 250);
		const json = JSON.stringify(limited);
		return json.length > 20000 ? json.slice(0, 20000) : json;
	};

	const captureVisibleTab = async () => {
		const tab = await getCurrentTab();
		if (!tab?.windowId) return null;
		try {
			return await chrome.tabs.captureVisibleTab(tab.windowId, {
				format: 'png',
			});
		} catch (e) {
			return null;
		}
	};

	const runAgent = async (currentTask: string) => {
		if (!currentTask.trim()) return;
		setIsRunning(true);
		const activeTemplate = templates.find((t) => t.id === activeTemplateId);
		const taskForAgent = activeTemplate
			? `${activeTemplate.content}\n\nUser Task:\n${currentTask}`
			: currentTask;
		addMessage('user', currentTask);
		if (activeTemplate) {
			addMessage('system', `Template: ${activeTemplate.name}`);
		}
		setTask('');
		const runtimeMaxSteps = Math.max(1, Math.floor(maxSteps));
		const runtimeRequestTimeoutMs = Math.max(1000, Math.floor(requestTimeoutMs));
		const runtimeStepDelayMs = Math.max(0, Math.floor(stepDelayMs));
		const runtimeInvalidRetryBaseMs = Math.max(
			0,
			Math.floor(invalidRetryBaseMs)
		);
		const runtimeInvalidRetryIncrementMs = Math.max(
			0,
			Math.floor(invalidRetryIncrementMs)
		);
		const runtimeInvalidRetryMaxMs = Math.max(
			0,
			Math.floor(invalidRetryMaxMs)
		);

		// Initial Brain
		const brain = new AgentBrain(
			apiKey,
			baseUrl,
			modelName,
			runtimeRequestTimeoutMs
		);
		const fileContext = buildFileContext();
		const imageAttachments = buildImageAttachments();
		const assetCatalog = buildAssetCatalog();
		if (!supportsVision && imageAttachments.length > 0) {
			addMessage(
				'system',
				'Image files are attached but vision support is disabled for this model.'
			);
		}

		let stepCount = 0;
		const actionHistory: string[] = [];
		const pageHistory: string[] = [];
		const recentActions: string[] = [];
		let failureCount = 0;
		let invalidResponseCount = 0;
		activeRef.current = true;
		(window as any).stopAgent = () => {
			activeRef.current = false;
			setIsRunning(false);
		};

		try {
			while (activeRef.current && stepCount < runtimeMaxSteps) {
				const tab = await getCurrentTab();
				if (!tab?.id) throw new Error('No active tab');

				let state: any = null;
				try {
					state = await chrome.tabs.sendMessage(tab.id, {
						type: 'GET_CONTENT',
					});
				} catch (e) {
					throw new Error(
						'Could not connect to page. Try refreshing the page.'
					);
				}

				if (!state) throw new Error('Could not read page content.');

				if (!activeRef.current) break;

				const pageHash = hashString(state.content || '');
				pageHistory.push(pageHash);
				if (pageHistory.length > 6) pageHistory.shift();

				// --- Call Local Brain ---
				const screenshot = supportsVision ? await captureVisibleTab() : null;
				const elementMap = buildElementMapSummary(state.elements || []);
				const stream = brain.processStep(
					{
						task: taskForAgent,
						url: state.url,
						pageContent: state.content,
						history: actionHistory,
						fileContext,
						elementMap,
						assetCatalog,
						supportsVision,
						screenshotDataUrl: screenshot || undefined,
						viewport: state.viewport,
						attachedImages: supportsVision ? imageAttachments : [],
					}
				);

				let fullText = '';
				addMessage('agent', '');

				for await (const chunk of stream) {
					if (!activeRef.current) break;
					fullText += chunk;
					setMessages((prev) => {
						const last = prev[prev.length - 1];
						if (last.role === 'agent') {
							return [...prev.slice(0, -1), { ...last, content: fullText }];
						}
						return prev;
					});
				}

				if (!activeRef.current) break;

				// Parsing Logic (tolerant of local model JSON quirks)
				const decision = parseAgentDecision(fullText);

				if (!decision || !decision.action) {
					invalidResponseCount += 1;
					addMessage('system', `Raw response:\n${fullText}`);
					const retryDelay = Math.min(
						runtimeInvalidRetryMaxMs,
						runtimeInvalidRetryBaseMs +
							invalidResponseCount * runtimeInvalidRetryIncrementMs
					);
					addMessage(
						'system',
						`Invalid response. Retrying in ${retryDelay}ms...`
					);
					await new Promise((r) => setTimeout(r, retryDelay));
					continue;
				}
				invalidResponseCount = 0;
				const normalized = normalizeDecision(decision);

				const allowedActions = [
					'CLICK',
					'CLICK_INDEX',
					'CLICK_ID',
					'CLICK_COORDS',
					'TYPE',
					'TYPE_ID',
					'TYPE_COORDS',
					'NAVIGATE',
					'SCROLL',
					'WAIT',
					'HOVER',
					'HOVER_ID',
					'HOVER_COORDS',
					'SELECT',
					'SELECT_ID',
					'UPLOAD_ASSET',
					'KEY',
					'DONE',
					'ASK',
				];
				if (!allowedActions.includes(normalized.action)) {
					throw new Error(`Unsupported action: ${normalized.action}`);
				}
				const actionValidationError = validateActionPayload(normalized);
				if (actionValidationError) {
					invalidResponseCount += 1;
					addMessage(
						'system',
						`Invalid action payload: ${actionValidationError}. Retrying...`
					);
					const retryDelay = Math.min(
						runtimeInvalidRetryMaxMs,
						runtimeInvalidRetryBaseMs +
							invalidResponseCount * runtimeInvalidRetryIncrementMs
					);
					await new Promise((r) => setTimeout(r, retryDelay));
					continue;
				}
				invalidResponseCount = 0;

				const actionKey = `${normalized.action}:${JSON.stringify(
					normalized.params || {}
				)}`;
				recentActions.push(actionKey);
				if (recentActions.length > 4) recentActions.shift();
				const isRepeating =
					recentActions.length === 4 &&
					recentActions.every((a) => a === actionKey);
				const isStuck =
					pageHistory.length >= 3 &&
					pageHistory.slice(-3).every((h) => h === pageHash);
				if (isRepeating && isStuck) {
					activeRef.current = false;
					addMessage(
						'system',
						'Agent seems stuck. Please guide the next step.'
					);
					break;
				}

				actionHistory.push(
					`Action: ${normalized.action} Params: ${JSON.stringify(
						normalized.params
					)}`
				);

				if (normalized.action === 'DONE') {
					activeRef.current = false;
					addMessage('system', 'Task Completed.');
					break;
				}

				if (normalized.action === 'ASK') {
					activeRef.current = false;
					addMessage('system', `Question: ${normalized.params.question}`);
					break;
				}

				const result: any = await chrome.tabs.sendMessage(tab.id, {
					type: 'EXECUTE_ACTION',
					action: normalized,
					assets,
				});

				addMessage('system', `Result: ${result.result}`);
				actionHistory.push(`Result: ${result.result}`);
				if (
					typeof result.result === 'string' &&
					/(Failed|Error)/i.test(result.result)
				) {
					failureCount += 1;
				} else {
					failureCount = 0;
				}
				if (failureCount >= 3) {
					activeRef.current = false;
					addMessage(
						'system',
						'Too many failures. Please adjust the task or provide guidance.'
					);
					break;
				}

				stepCount++;
				await new Promise((r) => setTimeout(r, runtimeStepDelayMs));
			}
		} catch (e: any) {
			addMessage('system', `Error: ${e.message}`);
		} finally {
			setIsRunning(false);
		}
	};

	const runAsk = async (currentTask: string) => {
		if (!currentTask.trim()) return;
		setIsRunning(true);
		const activeTemplate = templates.find((t) => t.id === activeTemplateId);
		const taskForAgent = activeTemplate
			? `${activeTemplate.content}\n\nUser Question:\n${currentTask}`
			: currentTask;
		addMessage('user', currentTask);
		if (activeTemplate) {
			addMessage('system', `Template: ${activeTemplate.name}`);
		}
		setTask('');
		const runtimeRequestTimeoutMs = Math.max(1000, Math.floor(requestTimeoutMs));

		const brain = new AgentBrain(
			apiKey,
			baseUrl,
			modelName,
			runtimeRequestTimeoutMs
		);
		const fileContext = buildFileContext();
		const imageAttachments = buildImageAttachments();
		if (!supportsVision && imageAttachments.length > 0) {
			addMessage(
				'system',
				'Image files are attached but vision support is disabled for this model.'
			);
		}
		activeRef.current = true;
		(window as any).stopAgent = () => {
			activeRef.current = false;
			setIsRunning(false);
		};

		try {
			const tab = await getCurrentTab();
			if (!tab?.id) throw new Error('No active tab');

			let state: any = null;
			try {
				state = await chrome.tabs.sendMessage(tab.id, {
					type: 'GET_CONTENT',
				});
			} catch {
				throw new Error('Could not connect to page. Try refreshing the page.');
			}
			if (!state) throw new Error('Could not read page content.');
			const screenshot = supportsVision ? await captureVisibleTab() : null;
			const elementMap = buildElementMapSummary(state.elements || []);

			const stream = brain.askPage({
				question: taskForAgent,
				url: state.url,
				pageContent: state.content,
				fileContext,
				elementMap,
				supportsVision,
				screenshotDataUrl: screenshot || undefined,
				viewport: state.viewport,
				attachedImages: supportsVision ? imageAttachments : [],
			});

			let fullText = '';
			addMessage('agent', '');
			for await (const chunk of stream) {
				if (!activeRef.current) break;
				fullText += chunk;
				setMessages((prev) => {
					const last = prev[prev.length - 1];
					if (last.role === 'agent') {
						return [...prev.slice(0, -1), { ...last, content: fullText }];
					}
					return prev;
				});
			}
		} catch (e: any) {
			addMessage('system', `Error: ${e.message}`);
		} finally {
			setIsRunning(false);
		}
	};

	const runCurrentMode = () =>
		interactionMode === 'ask' ? runAsk(task) : runAgent(task);

	const getCurrentTab = async () => {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		return tab;
	};

	const addMessage = (role: 'user' | 'agent' | 'system', content: string) => {
		setMessages((prev) => [...prev, { role, content }]);
	};

	const computeAssetSuggestions = (value: string, caret: number | null) => {
		if (!caret) return { active: false, query: '' };
		const upto = value.slice(0, caret);
		const atIndex = upto.lastIndexOf('@');
		if (atIndex === -1) return { active: false, query: '' };
		const query = upto.slice(atIndex + 1);
		if (query.includes(' ')) return { active: false, query: '' };
		return { active: true, query };
	};

	const applyAssetMention = (name: string) => {
		const input = inputRef.current;
		if (!input) return;
		const caret = input.selectionStart ?? input.value.length;
		const upto = input.value.slice(0, caret);
		const atIndex = upto.lastIndexOf('@');
		if (atIndex === -1) return;
		const before = input.value.slice(0, atIndex);
		const after = input.value.slice(caret);
		const next = `${before}@asset:${name} ${after}`;
		setTask(next);
		setShowAssetSuggestions(false);
		setAssetQuery('');
		requestAnimationFrame(() => {
			input.focus();
			const pos = (before + `@asset:${name} `).length;
			input.setSelectionRange(pos, pos);
		});
	};

	const activeTemplateDisplay = templates.find(
		(t) => t.id === activeTemplateId
	);
	const inputClass = isDark
		? 'w-full bg-gpt-surface border border-gpt-border rounded p-2 text-sm text-gpt-text placeholder:text-gpt-muted'
		: 'w-full bg-white border border-slate-200 rounded p-2 text-sm';
	const panelClass = isDark
		? 'bg-gpt-elevated/35 border border-gpt-border'
		: 'bg-white border border-slate-200';
	const labelClass = isDark ? 'text-gpt-muted' : 'text-gray-600';
	const subtleClass = isDark ? 'text-gpt-muted' : 'text-gray-600';
	const secondaryButtonClass = isDark
		? 'bg-gpt-surface hover:bg-gpt-elevated text-gpt-text border border-gpt-border'
		: 'bg-slate-200 hover:bg-slate-300 text-slate-900';

	if (showSettings) {
		return (
			<div
				className={`w-full h-screen p-4 font-sans overflow-y-auto ${
					isDark ? 'bg-gpt-canvas text-gpt-text' : 'bg-slate-100 text-slate-900'
				}`}
				style={{ colorScheme: isDark ? 'dark' : 'light' }}
			>
				<h2 className='text-lg font-bold mb-4'>Agent Settings</h2>
				<div className='space-y-6'>
						<div className={`${panelClass} rounded-lg p-4`}>
							<div className='text-xs font-semibold text-gpt-accent mb-3 uppercase tracking-wide'>
								Unified Agent Model
							</div>
						<div className='space-y-4'>
							<div>
								<label className={`block text-sm mb-1 ${labelClass}`}>
									Base URL (e.g., http://localhost:11434/v1)
								</label>
								<input
									className={inputClass}
									value={baseUrl}
									onChange={(e) => setBaseUrl(e.target.value)}
								/>
							</div>
							<div>
								<label className={`block text-sm mb-1 ${labelClass}`}>
									API Key
								</label>
								<input
									type='password'
									className={inputClass}
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
								/>
							</div>
							<div>
								<div className='flex justify-between items-center mb-1'>
									<label className={`block text-sm ${labelClass}`}>
										Model Name
									</label>
									<div className='flex items-center gap-3'>
										<label
											className={`flex items-center gap-1 text-xs ${subtleClass}`}
										>
											<input
												type='checkbox'
												className='accent-gpt-accent'
												checked={useManualModel}
													onChange={(e) =>
														setUseManualModel(e.target.checked)
													}
											/>
											Manual
										</label>
										<button
											onClick={fetchModels}
											className='text-xs text-gpt-accent hover:text-gpt-accent-hover'
										>
											↻ Fetch Models
										</button>
									</div>
								</div>
								{!useManualModel && availableModels.length > 0 ? (
									<select
										className={inputClass}
										value={modelName}
										onChange={(e) => setModelName(e.target.value)}
									>
										{availableModels.map((m) => (
											<option key={m} value={m}>
												{m}
											</option>
										))}
									</select>
								) : (
									<input
										className={inputClass}
										value={modelName}
										onChange={(e) => setModelName(e.target.value)}
										placeholder='e.g. gpt-4o'
									/>
								)}
								</div>
									<div>
										<div className={`text-sm mb-2 ${labelClass}`}>Capabilities</div>
									<label
										className={`flex items-center gap-2 text-sm ${
											isDark ? 'text-gpt-text' : 'text-slate-700'
										}`}
									>
										<input
											type='checkbox'
											className='accent-gpt-accent'
											checked={supportsVision}
											onChange={(e) => setSupportsVision(e.target.checked)}
										/>
										Vision support (model can read screenshots and image files)
									</label>
										<div className={`text-xs mt-2 ${subtleClass}`}>
											When enabled, the same model receives screenshot and image
											inputs in the main decision step.
										</div>
									</div>
									<div>
										<div className={`text-sm mb-2 ${labelClass}`}>
											Runtime Controls
										</div>
										<div className='grid grid-cols-1 gap-3'>
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Max Steps
												</label>
												<input
													type='number'
													min={1}
													className={inputClass}
													value={maxSteps}
													onChange={(e) => {
														const next = Number(e.target.value);
														setMaxSteps(Number.isFinite(next) ? next : 1);
													}}
												/>
											</div>
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Model Request Timeout (ms)
												</label>
												<input
													type='number'
													min={1000}
													className={inputClass}
													value={requestTimeoutMs}
													onChange={(e) => {
														const next = Number(e.target.value);
														setRequestTimeoutMs(Number.isFinite(next) ? next : 1000);
													}}
												/>
											</div>
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Delay Between Steps (ms)
												</label>
												<input
													type='number'
													min={0}
													className={inputClass}
													value={stepDelayMs}
													onChange={(e) => {
														const next = Number(e.target.value);
														setStepDelayMs(Number.isFinite(next) ? next : 0);
													}}
												/>
											</div>
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Invalid Retry Base Delay (ms)
												</label>
												<input
													type='number'
													min={0}
													className={inputClass}
													value={invalidRetryBaseMs}
													onChange={(e) => {
														const next = Number(e.target.value);
														setInvalidRetryBaseMs(Number.isFinite(next) ? next : 0);
													}}
												/>
											</div>
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Invalid Retry Increment (ms)
												</label>
												<input
													type='number'
													min={0}
													className={inputClass}
													value={invalidRetryIncrementMs}
													onChange={(e) => {
														const next = Number(e.target.value);
														setInvalidRetryIncrementMs(
															Number.isFinite(next) ? next : 0
														);
													}}
												/>
											</div>
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Invalid Retry Max Delay (ms)
												</label>
												<input
													type='number'
													min={0}
													className={inputClass}
													value={invalidRetryMaxMs}
													onChange={(e) => {
														const next = Number(e.target.value);
														setInvalidRetryMaxMs(Number.isFinite(next) ? next : 0);
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							</div>

					<div className={`${panelClass} rounded-lg p-4`}>
						<div className='text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'>
							Assets (Upload Only)
						</div>
						<div className='space-y-3'>
							<label
								className={`cursor-pointer text-xs ${
									isDark ? 'text-gpt-accent' : 'text-amber-700'
								}`}
							>
								＋ Add Assets
								<input
									type='file'
									className='hidden'
									multiple
									onChange={(e) => addAssets(e.target.files)}
								/>
							</label>
							{assets.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No assets yet.</div>
							) : (
								<div className='space-y-2'>
									{assets.map((asset) => (
										<div
											key={asset.id}
											className={`flex items-center justify-between rounded px-2 py-2 text-xs ${
												isDark
													? 'bg-gpt-surface border border-gpt-border'
													: 'bg-slate-100 border border-slate-200'
											}`}
										>
											<div className='truncate'>{asset.name}</div>
											<button
												onClick={() => removeAsset(asset.id)}
												className='text-red-400 hover:text-red-300'
												title='Remove'
											>
												✕
											</button>
										</div>
									))}
								</div>
							)}
							<div className={`text-xs ${subtleClass}`}>
								Use @ to reference assets by name in tasks.
							</div>
						</div>
					</div>

					<div className='flex gap-2 pt-2'>
						<button
							onClick={saveSettings}
							className='bg-gpt-accent hover:bg-gpt-accent-hover text-white rounded px-4 py-2 text-sm flex-1'
						>
							Save & Close
						</button>
						<button
							onClick={() => setShowSettings(false)}
							className={`${secondaryButtonClass} rounded px-4 py-2 text-sm`}
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`w-full h-screen flex flex-col font-sans ${
				isDark ? 'bg-gpt-canvas text-gpt-text' : 'bg-slate-100 text-slate-900'
			}`}
			style={{ colorScheme: isDark ? 'dark' : 'light' }}
		>
			<div
				className={`p-4 border-b ${
					isDark
						? 'border-gpt-border bg-gpt-sidebar'
						: 'border-slate-200 bg-white'
				} flex justify-between items-center`}
			>
				<div className='flex items-center gap-2'>
					<div
						className={`w-3 h-3 rounded-full ${
							isRunning
								? 'bg-gpt-accent animate-pulse'
								: isDark
								? 'bg-gpt-muted'
								: 'bg-gray-400'
						}`}
					></div>
					<h1
						className={`text-lg font-semibold ${
							isDark
								? 'text-gpt-text'
								: 'bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent'
						}`}
					>
						NavAI
					</h1>
				</div>
				<div className='flex gap-2'>
					{isRunning && (
						<button
							onClick={() =>
								(window as any).stopAgent && (window as any).stopAgent()
							}
							className='text-red-500 hover:text-red-600 text-xs border border-red-500/50 rounded px-2 py-1 transition-colors'
						>
							STOP
						</button>
					)}
					<button
						onClick={() => setShowTemplatePanel((v) => !v)}
						className={`text-xs border rounded px-2 py-1 ${
							showTemplatePanel
								? 'text-gpt-accent border-gpt-accent/60'
								: isDark
								? 'text-gpt-muted border-gpt-border hover:text-gpt-text'
								: 'text-gray-600 border-slate-200 hover:text-gray-900'
						}`}
						title='Templates'
					>
						⌘
					</button>
					<button
						onClick={() => setShowHistoryPanel((v) => !v)}
						className={`text-xs border rounded px-2 py-1 ${
							showHistoryPanel
								? 'text-gpt-text border-gpt-border'
								: isDark
								? 'text-gpt-muted border-gpt-border hover:text-gpt-text'
								: 'text-gray-600 border-slate-200 hover:text-gray-900'
						}`}
						title='History'
					>
						⏱
					</button>
					<button
						onClick={startNewChat}
						className={`text-xs border rounded px-2 py-1 ${
							isDark
								? 'text-gpt-accent border-gpt-accent/50 hover:text-gpt-accent-hover'
								: 'text-blue-600 border-blue-500/50 hover:text-blue-700'
						}`}
						title='New chat'
					>
						＋
					</button>
					<button
						onClick={() => setShowSettings(true)}
						className={
							isDark
								? 'text-gpt-muted hover:text-gpt-text'
								: 'text-gray-400 hover:text-gray-900'
						}
						title='Settings'
					>
						⚙
					</button>
				</div>
			</div>

			<div className='flex-1 flex min-h-0'>
				<div className='flex-1 flex flex-col min-w-0'>
					<div className='flex-1 overflow-y-auto p-4 space-y-4'>
						{messages.map((m, i) => (
							<div
								key={i}
								className={`flex ${
									m.role === 'user' ? 'justify-end' : 'justify-start'
								}`}
							>
								<div
									className={`max-w-[90%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
										m.role === 'user'
											? isDark
												? 'bg-gpt-user text-gpt-text border border-gpt-border/60'
												: 'bg-blue-500 text-white'
											: m.role === 'agent'
											? isDark
												? 'bg-gpt-surface border border-gpt-border text-gpt-text'
												: 'bg-white border border-slate-200'
											: isDark
											? 'text-gpt-muted text-xs bg-gpt-sidebar/50 border border-gpt-border/40'
											: 'text-gray-600 text-xs bg-slate-200/60'
									}`}
								>
									{m.role === 'agent'
										? (() => {
												const parsed = parseAgentMessage(m.content);
												const hasContent = m.content.trim().length > 0;
												return (
													<div className='space-y-2'>
														{!hasContent ? (
															<div
																className={`text-xs ${
																	isDark ? 'text-gpt-muted' : 'text-gray-500'
																}`}
															>
																Thinking…
															</div>
														) : parsed.hasStructuredContent ? (
															<div className='space-y-2'>
																{parsed.displayContent && (
																	<div className='text-sm whitespace-pre-wrap'>
																		{parsed.displayContent}
																	</div>
																)}
																{parsed.thinking && (
																	<details
																		className={`rounded border px-2 py-1 ${
																			isDark
																				? 'border-gpt-border bg-gpt-sidebar/30'
																				: 'border-slate-200 bg-slate-50'
																		}`}
																	>
																		<summary
																			className={`cursor-pointer text-xs select-none ${
																				isDark
																					? 'text-gpt-muted'
																					: 'text-gray-500'
																			}`}
																		>
																			Thinking
																		</summary>
																		<div className='text-sm mt-2 whitespace-pre-wrap'>
																			{parsed.thinking}
																		</div>
																	</details>
																)}
																{(parsed.actionType ||
																	parsed.actionSummary) && (
																	<div
																		className={`rounded border px-2 py-2 ${
																			isDark
																				? 'border-gpt-border bg-gpt-sidebar/20'
																				: 'border-slate-200 bg-slate-50'
																		}`}
																	>
																		<div
																			className={`text-xs mb-1 ${
																				isDark
																					? 'text-gpt-muted'
																					: 'text-gray-500'
																			}`}
																		>
																			Action
																		</div>
																		<div className='text-sm font-medium'>
																			{parsed.actionType
																				? parsed.actionType
																				: 'Unknown'}
																		</div>
																		{parsed.actionSummary && (
																			<div className='text-sm mt-1'>
																				{parsed.actionSummary}
																			</div>
																		)}
																		{parsed.actionDetails.length > 0 && (
																			<div className='mt-2 space-y-1'>
																				{parsed.actionDetails.map((detail) => (
																					<div
																						key={`${detail.label}:${detail.value}`}
																						className='text-xs whitespace-pre-wrap'
																					>
																						<span
																							className={
																								isDark
																									? 'text-gpt-muted'
																									: 'text-gray-500'
																							}
																						>
																							{detail.label}:
																						</span>{' '}
																						<span>{detail.value}</span>
																					</div>
																				))}
																			</div>
																		)}
																	</div>
																)}
															</div>
														) : (
															<div>{m.content}</div>
														)}
														{hasContent && (
															<button
																onClick={() =>
																	navigator.clipboard.writeText(m.content)
																}
																className={`text-xs ${
																	isDark
																		? 'text-gpt-accent hover:text-gpt-accent-hover'
																		: 'text-blue-600 hover:text-blue-700'
																}`}
																title='Copy raw response'
															>
																⧉
															</button>
														)}
													</div>
												);
										  })()
										: m.content}
								</div>
							</div>
						))}
						<div ref={bottomRef} />
					</div>

					<div
						className={`p-4 border-t ${
							isDark
								? 'border-gpt-border bg-gpt-canvas'
								: 'border-slate-200 bg-white'
						}`}
					>
						<div
							className={`flex items-center justify-between text-xs mb-2 ${
								isDark ? 'text-gpt-muted' : 'text-gray-600'
							}`}
						>
							<div>
								Template:{' '}
								{activeTemplateDisplay ? activeTemplateDisplay.name : 'None'}
							</div>
							<label
								className={`cursor-pointer ${
									isDark
										? 'text-gpt-accent hover:text-gpt-accent-hover'
										: 'text-blue-600 hover:text-blue-700'
								}`}
							>
								📎
								<input
									type='file'
									className='hidden'
									multiple
									onChange={(e) => addFiles(e.target.files)}
								/>
							</label>
						</div>
						{attachedFiles.length > 0 && (
							<div className='flex flex-wrap gap-2 mb-3'>
								{attachedFiles.map((file) => (
									<div
										key={file.id}
										className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
											isDark
												? 'bg-gpt-surface border border-gpt-border'
												: 'bg-slate-100 border border-slate-200'
										}`}
									>
										<span
											className={isDark ? 'text-gpt-text' : 'text-gray-700'}
										>
											{file.name}
										</span>
										<button
											onClick={() => removeFile(file.id)}
											className='text-red-400 hover:text-red-300'
											title='Remove'
										>
											✕
										</button>
									</div>
								))}
							</div>
						)}
						<div className='flex gap-2 mb-3'>
							<button
								onClick={() => setInteractionMode('agent')}
								disabled={isRunning}
								className={`text-xs px-3 py-1 rounded-full border ${
									interactionMode === 'agent'
										? 'bg-gpt-accent text-white border-gpt-accent'
										: isDark
										? 'border-gpt-border text-gpt-muted hover:text-gpt-text'
										: 'border-slate-300 text-slate-600 hover:text-slate-900'
								}`}
							>
								Agent
							</button>
							<button
								onClick={() => setInteractionMode('ask')}
								disabled={isRunning}
								className={`text-xs px-3 py-1 rounded-full border ${
									interactionMode === 'ask'
										? 'bg-gpt-accent text-white border-gpt-accent'
										: isDark
										? 'border-gpt-border text-gpt-muted hover:text-gpt-text'
										: 'border-slate-300 text-slate-600 hover:text-slate-900'
								}`}
							>
								Ask
							</button>
						</div>
						<div className='flex gap-2'>
							<input
								ref={inputRef}
								className={`flex-1 rounded-xl px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 transition-all ${
									isDark
										? 'bg-gpt-surface border border-gpt-border text-gpt-text placeholder:text-gpt-muted focus:ring-gpt-accent/35'
										: 'bg-white border border-slate-200 focus:ring-blue-500'
								}`}
								placeholder={
									isRunning
										? interactionMode === 'ask'
											? 'Ask mode is active...'
											: 'Agent is active...'
										: interactionMode === 'ask'
										? 'Ask about this page...'
										: 'Give a task to the agent...'
								}
								value={task}
								onChange={(e) => {
									const next = e.target.value;
									setTask(next);
									const caret = e.target.selectionStart;
									const { active, query } = computeAssetSuggestions(
										next,
										caret
									);
									setShowAssetSuggestions(active);
									setAssetQuery(query);
								}}
								disabled={isRunning}
								onKeyDown={(e) =>
									e.key === 'Enter' && !isRunning && runCurrentMode()
								}
							/>
							<button
								disabled={isRunning}
								onClick={runCurrentMode}
								className='bg-gpt-accent hover:bg-gpt-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-all shadow-md shadow-black/20'
							>
								{isRunning ? '…' : interactionMode === 'ask' ? 'Ask' : 'Go'}
							</button>
						</div>
						{showAssetSuggestions && assets.length > 0 && (
							<div
								className={`mt-2 rounded-lg border text-xs ${
									isDark
										? 'border-gpt-border bg-gpt-sidebar'
										: 'border-slate-200 bg-white'
								}`}
							>
								{assets
									.filter((a) =>
										a.name.toLowerCase().includes(assetQuery.toLowerCase())
									)
									.slice(0, 6)
									.map((asset) => (
										<button
											key={asset.id}
											className={`w-full text-left px-3 py-2 ${
												isDark ? 'hover:bg-gpt-surface' : 'hover:bg-slate-100'
											}`}
											onClick={() => applyAssetMention(asset.name)}
										>
											{asset.name}
										</button>
									))}
							</div>
						)}
						<div
							className={`text-xs text-center mt-2 ${
								isDark ? 'text-gpt-muted' : 'text-gray-500'
							}`}
						>
							Model: {modelName} | Mode: {interactionMode === 'ask' ? 'Ask' : 'Agent'}
						</div>
					</div>
				</div>

				{(showTemplatePanel || showHistoryPanel) && (
					<div
						className={`w-80 border-l ${
							isDark
								? 'border-gpt-border bg-gpt-sidebar'
								: 'border-slate-200 bg-white'
						} p-4 space-y-4 overflow-y-auto`}
					>
						{showTemplatePanel && (
							<div className={`${panelClass} rounded-lg p-4`}>
								<div className='flex items-center justify-between mb-3'>
									<div className='text-xs font-semibold text-gpt-accent uppercase tracking-wide'>
										Prompt Templates
									</div>
									<button
										onClick={() => {
											clearTemplateEditor();
											setShowTemplateForm(true);
										}}
										className={`text-xs px-2 py-1 rounded border ${
											isDark
												? 'text-gpt-accent border-gpt-accent/60'
												: 'text-emerald-600 border-emerald-500/60'
										}`}
										title='New template'
									>
										＋
									</button>
								</div>
								<div className='space-y-4'>
									<div>
										<label className={`block text-sm mb-2 ${labelClass}`}>
											Saved Templates
										</label>
										{templates.length === 0 ? (
											<div className={`text-xs ${subtleClass}`}>
												No templates yet.
											</div>
										) : (
											<div className='space-y-2'>
												{templates.map((t) => (
													<div
														key={t.id}
														className={`relative rounded border px-2 py-2 text-xs ${
															isDark
																? 'border-gpt-border bg-gpt-surface/60'
																: 'border-slate-200 bg-slate-50'
														}`}
													>
														<button
															onClick={() => {
																setActiveTemplateId(t.id);
																setTask(t.content);
															}}
															className='w-full text-left'
															title='Load into task input'
														>
															<div className='truncate'>{t.name}</div>
															<div
																className={`truncate ${
																	isDark ? 'text-gpt-muted' : 'text-gray-500'
																}`}
															>
																{t.content.slice(0, 80)}
																{t.content.length > 80 ? '…' : ''}
															</div>
														</button>
														<button
															onClick={() =>
																setOpenTemplateMenuId(
																	openTemplateMenuId === t.id ? null : t.id
																)
															}
															className={`absolute top-2 right-2 text-xs px-2 py-1 rounded border ${
																isDark
																	? 'border-gpt-border text-gpt-muted hover:text-gpt-text'
																	: 'border-slate-200 text-gray-600 hover:text-gray-900'
															}`}
															title='More'
														>
															⋯
														</button>
														{openTemplateMenuId === t.id && (
															<div
																className={`absolute right-2 top-9 z-10 rounded border p-1 text-xs ${
																	isDark
																		? 'bg-gpt-surface border-gpt-border'
																		: 'bg-white border-slate-200'
																}`}
															>
																<button
																	onClick={() => {
																		setOpenTemplateMenuId(null);
																		startEditTemplate(t.id);
																	}}
																	className={`block w-full text-left px-2 py-1 rounded ${
																		isDark
																			? 'hover:bg-gpt-elevated'
																			: 'hover:bg-slate-100'
																	}`}
																>
																	Edit
																</button>
																<button
																	onClick={() => deleteTemplateById(t.id)}
																	className={`block w-full text-left px-2 py-1 rounded ${
																		isDark
																			? 'text-red-400 hover:bg-gpt-elevated'
																			: 'text-red-600 hover:bg-slate-100'
																	}`}
																>
																	Delete
																</button>
															</div>
														)}
													</div>
												))}
											</div>
										)}
									</div>
									<div>
										<label className={`block text-sm mb-1 ${labelClass}`}>
											Active Template
										</label>
										<select
											className={inputClass}
											value={activeTemplateId}
											onChange={(e) => setActiveTemplateId(e.target.value)}
										>
											<option value=''>None</option>
											{templates.map((t) => (
												<option key={t.id} value={t.id}>
													{t.name}
												</option>
											))}
										</select>
									</div>

									{showTemplateForm && (
										<div className='space-y-3'>
											<div>
												<label className={`block text-sm mb-1 ${labelClass}`}>
													Template Name
												</label>
												<input
													className={inputClass}
													value={templateName}
													onChange={(e) => setTemplateName(e.target.value)}
													placeholder='e.g. Job Application'
												/>
											</div>
											<div>
												<label className={`block text-sm mb-1 ${labelClass}`}>
													Template Content
												</label>
												<textarea
													className={`w-full rounded p-2 text-sm h-28 ${
														isDark
															? 'bg-gpt-surface border border-gpt-border text-gpt-text placeholder:text-gpt-muted'
															: 'bg-white border border-slate-200'
													}`}
													value={templateContent}
													onChange={(e) => setTemplateContent(e.target.value)}
													placeholder='Add system-level instructions or constraints...'
												/>
											</div>
											<div className='flex gap-2'>
												<button
													onClick={saveTemplate}
													className='bg-gpt-accent hover:bg-gpt-accent-hover text-white rounded px-4 py-2 text-sm flex-1'
												>
													{editingTemplateId
														? 'Update Template'
														: 'Save Template'}
												</button>
												<button
													onClick={clearTemplateEditor}
													className={`${secondaryButtonClass} rounded px-4 py-2 text-sm`}
												>
													Cancel
												</button>
											</div>
										</div>
									)}
								</div>
							</div>
						)}

						{showHistoryPanel && (
							<div className={`${panelClass} rounded-lg p-4`}>
								<div
									className={`text-xs font-semibold mb-3 uppercase tracking-wide ${
										isDark ? 'text-gpt-text' : 'text-gray-500'
									}`}
								>
									Session History
								</div>
								<div className='flex items-center justify-between'>
									<div
										className={`text-xs ${
											isDark ? 'text-gpt-muted' : 'text-gray-600'
										}`}
									>
										Messages: {messages.length}
									</div>
									<button
										onClick={clearSession}
										className={`${secondaryButtonClass} rounded px-4 py-2 text-xs`}
									>
										Clear History
									</button>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default App;




