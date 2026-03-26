import { useState, useEffect, useRef } from 'react';
import { AgentBrain } from '../../agent/brain';
import {
	createTabSessionManager,
	clearTabSessionState,
} from '../../agent/tabSessionManager';
import {
	parseMcpServersJsonInput,
	toMcpServersJsonText,
	type McpServerConfig,
} from '../../agent/mcpConfig';
import {
	buildMcpToolCatalogText,
	callMcpTool,
	listMcpTools,
	testMcpConnection,
} from '../../agent/mcpClient';
import type { Message } from '../types/Message';
import type { PromptTemplate } from '../types/PromptTemplate';
import type { AttachedFile } from '../types/AttachedFile';
import type { AssetFile } from '../types/AssetFile';
import type { AgentSkill } from '../types/AgentSkill';
import type { UserContextEntry } from '../types/UserContextEntry';
import {
	sessionIdKey,
	assetsStorageKey,
	mcpServersStorageKey,
	userSkillsStorageKey,
	userContextsStorageKey,
	uiZoomStorageKey,
	uiZoomMin,
	uiZoomMax,
	uiZoomStep,
	uiZoomDefault,
} from '../agentStorageConstants';
import getSessionMessagesKey from '../getSessionMessagesKey';
import createSessionId from '../createSessionId';
import resolveInitialSessionId from '../resolveInitialSessionId';
import normalizeSkillKey from '../normalizeSkillKey';
import defaultSkillTemplate from '../defaultSkillTemplate';
import parseAgentDecision from '../agentDecision/parseAgentDecision';
import normalizeDecision from '../agentDecision/normalizeDecision';
import validateActionPayload from '../agentDecision/validateActionPayload';
import buildElementMapSummary from '../agentDecision/buildElementMapSummary';
import hashString from '../agentDecision/hashString';
import captureVisibleTab from '../chrome/captureVisibleTab';
import getCurrentTab from '../chrome/getCurrentTab';
import readFileAsText from '../file/readFileAsText';
import readFileAsDataUrl from '../file/readFileAsDataUrl';
import getSkillNameFromContent from '../getSkillNameFromContent';
import enrichMcpArgumentsWithAssets from '../mcp/enrichMcpArgumentsWithAssets';

const useAgentApp = () => {
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
	const [maxConsecutiveFailures, setMaxConsecutiveFailures] = useState(
		() =>
			Number(localStorage.getItem('agent_max_consecutive_failures') || '3') ||
			3
	);
	const [mcpServers, setMcpServers] = useState<McpServerConfig[]>(() => {
		try {
			const raw = localStorage.getItem(mcpServersStorageKey);
			return raw ? parseMcpServersJsonInput(raw) : [];
		} catch {
			return [];
		}
	});
	const [showAddMcp, setShowAddMcp] = useState(false);
	const [mcpJsonInput, setMcpJsonInput] = useState('');
	const [mcpInputError, setMcpInputError] = useState('');
	const [mcpTestingById, setMcpTestingById] = useState<Record<string, boolean>>(
		{}
	);
	const [mcpTestResultById, setMcpTestResultById] = useState<
		Record<string, string>
	>({});
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
	const [sessionId, setSessionId] = useState(() => resolveInitialSessionId());
	const [showTemplatePanel, setShowTemplatePanel] = useState(false);
	const [showHistoryPanel, setShowHistoryPanel] = useState(false);
	const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false);
	const [isMcpSettingsOpen, setIsMcpSettingsOpen] = useState(false);
	const [isAssetsSettingsOpen, setIsAssetsSettingsOpen] = useState(false);
	const [isAgentCreatedAssetsOpen, setIsAgentCreatedAssetsOpen] = useState(
		false
	);
	const [isUserContextSettingsOpen, setIsUserContextSettingsOpen] = useState(
		false
	);
	const [isSkillsSettingsOpen, setIsSkillsSettingsOpen] = useState(false);
	const [uiZoom, setUiZoom] = useState(() => {
		const raw = Number(localStorage.getItem(uiZoomStorageKey));
		if (!Number.isFinite(raw)) return uiZoomDefault;
		return Math.max(uiZoomMin, Math.min(uiZoomMax, raw));
	});
	const [isDark, setIsDark] = useState(true);
	const [showTemplateForm, setShowTemplateForm] = useState(false);
	const [openTemplateMenuId, setOpenTemplateMenuId] = useState<string | null>(
		null
	);
	const [openMcpMenuId, setOpenMcpMenuId] = useState<string | null>(null);
	const [openAssetMenuId, setOpenAssetMenuId] = useState<string | null>(null);
	const [showAssetSuggestions, setShowAssetSuggestions] = useState(false);
	const [assetQuery, setAssetQuery] = useState('');
	const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
	const [userSkills, setUserSkills] = useState<AgentSkill[]>(() => {
		try {
			const raw = localStorage.getItem(userSkillsStorageKey);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed
				.filter(
					(item) =>
						item &&
						typeof item === 'object' &&
						typeof item.id === 'string' &&
						typeof item.name === 'string' &&
						typeof item.content === 'string'
				)
				.map((item: any) => ({
					id: String(item.id),
					name: String(item.name),
					content: String(item.content),
					source: 'user' as const,
				}));
		} catch {
			return [];
		}
	});
	const [predefinedSkills, setPredefinedSkills] = useState<AgentSkill[]>([]);
	const [showSkillForm, setShowSkillForm] = useState(false);
	const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
	const [skillContent, setSkillContent] = useState(defaultSkillTemplate);
	const [openSkillMenuId, setOpenSkillMenuId] = useState<string | null>(null);
	const [userContexts, setUserContexts] = useState<UserContextEntry[]>(() => {
		try {
			const raw = localStorage.getItem(userContextsStorageKey);
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return [];
			return parsed
				.filter(
					(item) =>
						item &&
						typeof item === 'object' &&
						typeof item.id === 'string' &&
						typeof item.name === 'string' &&
						typeof item.content === 'string'
				)
				.map((item: any) => ({
					id: String(item.id),
					name: String(item.name),
					content: String(item.content),
				}));
		} catch {
			return [];
		}
	});
	const [selectedUserContextIds, setSelectedUserContextIds] = useState<string[]>(
		[]
	);
	const [showUserContextPicker, setShowUserContextPicker] = useState(false);
	const [showUserContextForm, setShowUserContextForm] = useState(false);
	const [editingUserContextId, setEditingUserContextId] = useState<string | null>(
		null
	);
	const [userContextName, setUserContextName] = useState('');
	const [userContextContent, setUserContextContent] = useState('');
	const [openUserContextMenuId, setOpenUserContextMenuId] = useState<
		string | null
	>(null);

	const bottomRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef(true);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const continueResolverRef = useRef<(() => void) | null>(null);
	const [waitingForUserAction, setWaitingForUserAction] = useState(false);

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
		localStorage.setItem(sessionIdKey, sessionId);
	}, [sessionId]);

	useEffect(() => {
		let canceled = false;
		const loadAssets = async () => {
			const stored = await chrome.storage.local.get(assetsStorageKey);
			const nextAssets = Array.isArray(stored?.[assetsStorageKey])
				? (stored[assetsStorageKey] as AssetFile[])
				: [];
			if (!canceled) setAssets(nextAssets);
		};
		loadAssets();
		return () => {
			canceled = true;
		};
	}, []);

	useEffect(() => {
		const persistAssets = async () => {
			await chrome.storage.local.set({ [assetsStorageKey]: assets });
		};
		persistAssets();
	}, [assets]);

	useEffect(() => {
		setSessionLoaded(false);
		try {
			const scopedKey = getSessionMessagesKey(sessionId);
			const scopedRaw = localStorage.getItem(scopedKey);
			if (scopedRaw) {
				setMessages(JSON.parse(scopedRaw));
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
	}, [sessionId]);

	useEffect(() => {
		if (!sessionLoaded) return;
		const snapshot = messages.slice(-200);
		localStorage.setItem(
			getSessionMessagesKey(sessionId),
			JSON.stringify(snapshot)
		);
	}, [messages, sessionLoaded, sessionId]);

	useEffect(() => {
		localStorage.setItem('agent_prompt_templates', JSON.stringify(templates));
	}, [templates]);

	useEffect(() => {
		localStorage.setItem('agent_active_template', activeTemplateId);
	}, [activeTemplateId]);

	useEffect(() => {
		localStorage.setItem(mcpServersStorageKey, toMcpServersJsonText(mcpServers));
	}, [mcpServers]);

	useEffect(() => {
		localStorage.setItem('agent_interaction_mode', interactionMode);
	}, [interactionMode]);

	useEffect(() => {
		let canceled = false;
		const loadPredefinedSkillsIndex = async () => {
			try {
				const response = await fetch('/skills/index.json');
				if (!response.ok) return;
				const parsed = await response.json();
				if (!Array.isArray(parsed) || canceled) return;
				const fromFile: AgentSkill[] = parsed
					.filter(
						(item) =>
							item &&
							typeof item === 'object' &&
							typeof item.name === 'string' &&
							typeof item.path === 'string' &&
							item.name.trim().length > 0 &&
							item.path.trim().length > 0
					)
					.map((item: any, index: number) => ({
						id: `skill_predefined_${index}_${normalizeSkillKey(String(item.name))}`,
						name: String(item.name).trim(),
						content: '',
						source: 'predefined' as const,
						filePath: String(item.path).trim(),
					}));
				if (canceled) return;
				setPredefinedSkills(fromFile);
			} catch {
				// Ignore when index is missing.
			}
		};
		loadPredefinedSkillsIndex();
		return () => {
			canceled = true;
		};
	}, []);

	useEffect(() => {
		localStorage.setItem(userSkillsStorageKey, JSON.stringify(userSkills));
	}, [userSkills]);

	useEffect(() => {
		localStorage.setItem(userContextsStorageKey, JSON.stringify(userContexts));
		setSelectedUserContextIds((prev) =>
			prev.filter((id) => userContexts.some((context) => context.id === id))
		);
	}, [userContexts]);

	useEffect(() => {
		localStorage.setItem(uiZoomStorageKey, String(uiZoom));
	}, [uiZoom]);

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
		localStorage.setItem(
			'agent_max_consecutive_failures',
			String(Math.max(1, Math.floor(maxConsecutiveFailures)))
		);
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
		localStorage.removeItem(getSessionMessagesKey(sessionId));
		clearTabSessionState(sessionId);
	};

	const addMcpServerFromJson = () => {
		const raw = mcpJsonInput.trim();
		if (!raw) return;
		try {
			const parsedServers = parseMcpServersJsonInput(raw);
			setMcpServers((prev) => {
				const prevByName = new Map(prev.map((item) => [item.name, item]));
				const nextServers = parsedServers.map((item) => {
					const prevItem = prevByName.get(item.name);
					return {
						...item,
						id: prevItem?.id || item.id,
					};
				});
				localStorage.setItem(
					mcpServersStorageKey,
					toMcpServersJsonText(nextServers)
				);
				setMcpJsonInput(toMcpServersJsonText(nextServers));
				return nextServers;
			});
			setMcpInputError('');
			setShowAddMcp(false);
			addMessage('system', `MCP servers saved (${parsedServers.length}).`);
		} catch (e: any) {
			setMcpInputError(e?.message || 'Invalid MCP JSON');
		}
	};

	const toggleMcpServer = (id: string) => {
		setMcpServers((prev) =>
			prev.map((item) =>
				item.id === id ? { ...item, enabled: !item.enabled } : item
			)
		);
	};

	const removeMcpServer = (id: string) => {
		setMcpServers((prev) => prev.filter((item) => item.id !== id));
	};

	const confirmAndRemoveMcpServer = (server: McpServerConfig) => {
		const ok = window.confirm(
			`Delete MCP server "${server.name}"?\nThis action cannot be undone.`
		);
		if (!ok) return;
		removeMcpServer(server.id);
		setOpenMcpMenuId(null);
	};

	const startEditMcpServer = () => {
		if (showAddMcp && mcpJsonInput.trim().length > 0) return;
		setShowAddMcp(true);
		setMcpInputError('');
		setMcpJsonInput(toMcpServersJsonText(mcpServers));
	};

	const testMcpServer = async (server: McpServerConfig) => {
		setMcpTestingById((prev) => ({ ...prev, [server.id]: true }));
		setMcpTestResultById((prev) => ({ ...prev, [server.id]: '' }));
		const result = await testMcpConnection(server);
		setMcpTestResultById((prev) => ({ ...prev, [server.id]: result.message }));
		setMcpTestingById((prev) => ({ ...prev, [server.id]: false }));
		addMessage(
			'system',
			result.ok
				? `MCP test passed: ${server.name} (${result.message})`
				: `MCP test failed: ${server.name} (${result.message})`
		);
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

	const saveSkill = () => {
		const content = skillContent.trim();
		if (!content) return;
		const extractedName = getSkillNameFromContent(content);
		const name = extractedName || `skill_${Date.now().toString(36)}`;
		if (editingSkillId) {
			setUserSkills((prev) =>
				prev.map((skill) =>
					skill.id === editingSkillId ? { ...skill, name, content } : skill
				)
			);
		} else {
			const id = `skill_${Date.now()}_${Math.random().toString(36).slice(2)}`;
			setUserSkills((prev) => [...prev, { id, name, content, source: 'user' }]);
		}
		setEditingSkillId(null);
		setSkillContent(defaultSkillTemplate);
		setShowSkillForm(false);
		setOpenSkillMenuId(null);
	};

	const startEditSkill = (id: string) => {
		const skill = userSkills.find((item) => item.id === id);
		if (!skill) return;
		setEditingSkillId(skill.id);
		setSkillContent(skill.content);
		setShowSkillForm(true);
		setOpenSkillMenuId(null);
	};

	const clearSkillEditor = () => {
		setEditingSkillId(null);
		setSkillContent(defaultSkillTemplate);
		setShowSkillForm(false);
	};

	const deleteSkillById = (id: string) => {
		const skill = userSkills.find((item) => item.id === id);
		if (!skill || skill.source !== 'user') return;
		const ok = window.confirm(
			`Delete skill "${skill.name}"?\nThis action cannot be undone.`
		);
		if (!ok) return;
		setUserSkills((prev) => prev.filter((item) => item.id !== id));
		if (editingSkillId === id) clearSkillEditor();
		setOpenSkillMenuId(null);
	};

	const saveUserContext = () => {
		const name = userContextName.trim();
		const content = userContextContent.trim();
		if (!name || !content) return;
		if (editingUserContextId) {
			setUserContexts((prev) =>
				prev.map((context) =>
					context.id === editingUserContextId
						? { ...context, name, content }
						: context
				)
			);
		} else {
			const id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
			setUserContexts((prev) => [...prev, { id, name, content }]);
		}
		setEditingUserContextId(null);
		setUserContextName('');
		setUserContextContent('');
		setShowUserContextForm(false);
		setOpenUserContextMenuId(null);
	};

	const startEditUserContext = (id: string) => {
		const context = userContexts.find((item) => item.id === id);
		if (!context) return;
		setEditingUserContextId(context.id);
		setUserContextName(context.name);
		setUserContextContent(context.content);
		setShowUserContextForm(true);
		setOpenUserContextMenuId(null);
	};

	const clearUserContextEditor = () => {
		setEditingUserContextId(null);
		setUserContextName('');
		setUserContextContent('');
		setShowUserContextForm(false);
	};

	const deleteUserContextById = (id: string) => {
		const context = userContexts.find((item) => item.id === id);
		if (!context) return;
		const ok = window.confirm(
			`Delete user context "${context.name}"?\nThis action cannot be undone.`
		);
		if (!ok) return;
		setUserContexts((prev) => prev.filter((item) => item.id !== id));
		if (editingUserContextId === id) clearUserContextEditor();
		setOpenUserContextMenuId(null);
	};

	const toggleSelectedUserContext = (id: string) => {
		setSelectedUserContextIds((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
		);
	};

	const buildSelectedUserContextBlock = () => {
		const selected = userContexts.filter((context) =>
			selectedUserContextIds.includes(context.id)
		);
		if (selected.length === 0) return '';
		return `\n\nUSER CONTEXT (selected only):\n${selected
			.map((context) => `Context: ${context.name}\n${context.content}`)
			.join('\n\n')}`;
	};

	const resolveRequestedSkillRefs = (text: string) => {
		const tags = Array.from(text.matchAll(/@skill:([^\s,;]+)/gi))
			.map((match) => match[1]?.trim() || '')
			.filter(Boolean);
		const uniqueKeys = Array.from(new Set(tags.map((tag) => normalizeSkillKey(tag))));
		const requestedSkills = uniqueKeys
			.map((key) =>
				skills.find((skill) => normalizeSkillKey(skill.name) === key) || null
			)
			.filter((skill): skill is AgentSkill => Boolean(skill));
		const missing = uniqueKeys.filter(
			(key) =>
				!skills.some((skill) => normalizeSkillKey(skill.name) === key)
		);
		return { requestedSkills, missing };
	};

	const loadRequestedSkills = async (text: string) => {
		const { requestedSkills, missing } = resolveRequestedSkillRefs(text);
		const loaded = await Promise.all(
			requestedSkills.map(async (skill) => {
				if (skill.source === 'predefined' && skill.filePath) {
					try {
						const response = await fetch(skill.filePath);
						if (!response.ok) return null;
						const content = (await response.text()).trim();
						if (!content) return null;
						return { ...skill, content };
					} catch {
						return null;
					}
				}
				const content = skill.content?.trim();
				if (!content) return null;
				return { ...skill, content };
			})
		);
		const available = loaded.filter((skill): skill is AgentSkill => Boolean(skill));
		const loadedKeys = new Set(available.map((skill) => normalizeSkillKey(skill.name)));
		const unavailableByFetch = requestedSkills
			.filter((skill) => !loadedKeys.has(normalizeSkillKey(skill.name)))
			.map((skill) => normalizeSkillKey(skill.name));
		const finalMissing = Array.from(new Set([...missing, ...unavailableByFetch]));
		return { requestedSkills: available, missing: finalMissing };
	};

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
				source: 'uploaded',
			});
		}

		if (newItems.length > 0) {
			setAssets((prev) => [...prev, ...newItems]);
		}
	};

	const removeAsset = (id: string) => {
		setAssets((prev) => prev.filter((f) => f.id !== id));
	};

	const confirmAndRemoveAsset = (asset: AssetFile) => {
		const ok = window.confirm(
			`Delete asset "${asset.name}"?\nThis action cannot be undone.`
		);
		if (!ok) return;
		removeAsset(asset.id);
		setOpenAssetMenuId(null);
		if (expandedAssetId === asset.id) {
			setExpandedAssetId(null);
		}
	};

	const downloadAsset = (asset: AssetFile) => {
		const link = document.createElement('a');
		link.href = asset.dataUrl;
		link.download = asset.name || 'asset.bin';
		link.rel = 'noopener';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setOpenAssetMenuId(null);
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
		const nextSessionId = createSessionId();
		localStorage.setItem(sessionIdKey, nextSessionId);
		setSessionId(nextSessionId);
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
			.map(
				(a) =>
					`${a.name} (${a.type}, ${a.size} bytes, ${a.source || 'uploaded'})`
			)
			.join('\n');
	};


	const runAgent = async (currentTask: string) => {
		if (!currentTask.trim()) return;
		setIsRunning(true);
		const activeTemplate = templates.find((t) => t.id === activeTemplateId);
		const baseTaskForAgentRaw = activeTemplate
			? `${activeTemplate.content}\n\nUser Task:\n${currentTask}`
			: currentTask;
		const userContextBlock = buildSelectedUserContextBlock();
		const baseTaskForAgent = `${baseTaskForAgentRaw}${userContextBlock}`;
		const { requestedSkills, missing } = await loadRequestedSkills(baseTaskForAgent);
		const requestedSkillsBlock =
			requestedSkills.length > 0
				? `\n\nREQUESTED SKILLS (load only these):\n${requestedSkills
						.map((skill) => `Skill: ${skill.name}\n${skill.content}`)
						.join('\n\n')}`
				: '';
		const taskForAgent = `${baseTaskForAgent}${requestedSkillsBlock}`;
		addMessage('user', currentTask);
		if (activeTemplate) {
			addMessage('system', `Template: ${activeTemplate.name}`);
		}
		const selectedContexts = userContexts.filter((context) =>
			selectedUserContextIds.includes(context.id)
		);
		if (selectedContexts.length > 0) {
			addMessage(
				'system',
				`User context loaded: ${selectedContexts
					.map((context) => context.name)
					.join(', ')}`
			);
		}
		if (requestedSkills.length > 0) {
			addMessage(
				'system',
				`Skills loaded: ${requestedSkills.map((skill) => skill.name).join(', ')}`
			);
		}
		if (missing.length > 0) {
			addMessage(
				'system',
				`Requested skill(s) not found: ${missing.join(', ')}. Use @skill:SkillName with an existing skill name.`
			);
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
		const runtimeMaxConsecutiveFailures = Math.max(
			1,
			Math.floor(maxConsecutiveFailures)
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
		const tabSession = createTabSessionManager(sessionId);
		let shouldRestoreMainTab = false;
		let taskCompleted = false;
		const mcpTools = await listMcpTools(mcpServers.filter((server) => server.enabled));
		const mcpCatalog = buildMcpToolCatalogText(mcpTools);
		activeRef.current = true;
		(window as any).stopAgent = () => {
			activeRef.current = false;
			releasePendingContinue();
			setIsRunning(false);
		};

		try {
			const initialTab = await getCurrentTab();
			if (!initialTab?.id) throw new Error('No active tab');
			await tabSession.beginRun(initialTab.id);
			shouldRestoreMainTab = true;

			while (activeRef.current && stepCount < runtimeMaxSteps) {
				const tabId = await tabSession.ensureCurrentTabActive();
				if (!tabId) throw new Error('No managed tab available');

				let state: any = null;
				try {
					state = await chrome.tabs.sendMessage(tabId, {
						type: 'GET_CONTENT',
					});
				} catch (e) {
					throw new Error(
						'Could not connect to page. Try refreshing the page.'
					);
				}

				if (!state) throw new Error('Could not read page content.');

				if (!activeRef.current) break;

				const tabContext = await tabSession.buildTabContext();
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
						tabContext,
						mcpCatalog,
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
					'OPEN_TAB',
					'SWITCH_TAB',
					'CLOSE_TAB',
					'CLOSE_EXTRA_TABS',
					'WAIT_FOR_USER_ACTION',
					'MCP_CALL',
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
					taskCompleted = true;
					activeRef.current = false;
					addMessage('system', 'Task Completed.');
					break;
				}

				if (normalized.action === 'ASK') {
					activeRef.current = false;
					addMessage('system', `Question: ${normalized.params.question}`);
					break;
				}

				if (normalized.action === 'WAIT_FOR_USER_ACTION') {
					const waitReason =
						typeof normalized.params.reason === 'string' &&
						normalized.params.reason.trim().length > 0
							? normalized.params.reason.trim()
							: 'Complete the needed manual step on the page.';
					setWaitingForUserAction(true);
					addMessage(
						'system',
						`Agent is waiting for your manual action on the page.\nReason: ${waitReason}\nClick Continue when done.`,
						'continue_agent'
					);
					await new Promise<void>((resolve) => {
						continueResolverRef.current = resolve;
					});
					continueResolverRef.current = null;
					setWaitingForUserAction(false);
					if (!activeRef.current) break;
					addMessage('system', 'User continued the task.');
					stepCount++;
					continue;
				}

				let actionResult = '';
				if (normalized.action === 'OPEN_TAB') {
					actionResult = await tabSession.openTab(
						String(normalized.params.url),
						Boolean(normalized.params.background)
					);
				} else if (normalized.action === 'SWITCH_TAB') {
					actionResult = await tabSession.switchTab({
						tabId:
							typeof normalized.params.tabId === 'number'
								? normalized.params.tabId
								: undefined,
						index:
							typeof normalized.params.index === 'number'
								? normalized.params.index
								: undefined,
						urlContains:
							typeof normalized.params.urlContains === 'string'
								? normalized.params.urlContains
								: undefined,
					});
				} else if (normalized.action === 'CLOSE_TAB') {
					actionResult = await tabSession.closeTab(
						typeof normalized.params.tabId === 'number'
							? normalized.params.tabId
							: undefined
					);
				} else if (normalized.action === 'CLOSE_EXTRA_TABS') {
					actionResult =
						'Deferred CLOSE_EXTRA_TABS until task completion. Continue with remaining steps.';
				} else if (normalized.action === 'MCP_CALL') {
					const enrichment = enrichMcpArgumentsWithAssets(
						normalized.params.arguments &&
							typeof normalized.params.arguments === 'object'
							? (normalized.params.arguments as Record<string, unknown>)
							: {},
						assets,
						setAssets
					);
					if (!enrichment.ok) {
						actionResult = `Failed MCP_CALL preflight: ${enrichment.error}`;
					} else {
						if (enrichment.attachmentSummary) {
							addMessage(
								'system',
								`MCP attachment preflight: ${enrichment.attachmentSummary}`
							);
						}
					actionResult = await callMcpTool(
						mcpServers,
						String(normalized.params.serverId || ''),
						String(normalized.params.tool || ''),
						enrichment.args
					);
					}
				} else {
					const targetTabId = await tabSession.getTargetTabId();
					if (!targetTabId) throw new Error('No target tab for action');
					const result: any = await chrome.tabs.sendMessage(targetTabId, {
						type: 'EXECUTE_ACTION',
						action: normalized,
						assets,
					});
					actionResult = result?.result || 'No result';
				}

				addMessage('system', `Result: ${actionResult}`);
				actionHistory.push(`Result: ${actionResult}`);
				if (
					typeof actionResult === 'string' &&
					/(Failed|Error|Refused)/i.test(actionResult)
				) {
					failureCount += 1;
				} else {
					failureCount = 0;
				}
				if (failureCount >= runtimeMaxConsecutiveFailures) {
					activeRef.current = false;
					addMessage(
						'system',
						`Too many failures (${runtimeMaxConsecutiveFailures}). Please adjust the task or provide guidance.`
					);
					break;
				}

				stepCount++;
				await new Promise((r) => setTimeout(r, runtimeStepDelayMs));
			}
		} catch (e: any) {
			addMessage('system', `Error: ${e.message}`);
		} finally {
			releasePendingContinue();
			if (shouldRestoreMainTab && taskCompleted) {
				try {
					await tabSession.closeExtraTabs();
				} catch {
					// Ignore cleanup failures.
				}
			}
			setIsRunning(false);
		}
	};

	const runAsk = async (currentTask: string) => {
		if (!currentTask.trim()) return;
		setIsRunning(true);
		const activeTemplate = templates.find((t) => t.id === activeTemplateId);
		const baseTaskForAgentRaw = activeTemplate
			? `${activeTemplate.content}\n\nUser Question:\n${currentTask}`
			: currentTask;
		const userContextBlock = buildSelectedUserContextBlock();
		const baseTaskForAgent = `${baseTaskForAgentRaw}${userContextBlock}`;
		const { requestedSkills, missing } = await loadRequestedSkills(baseTaskForAgent);
		const requestedSkillsBlock =
			requestedSkills.length > 0
				? `\n\nREQUESTED SKILLS (load only these):\n${requestedSkills
						.map((skill) => `Skill: ${skill.name}\n${skill.content}`)
						.join('\n\n')}`
				: '';
		const taskForAgent = `${baseTaskForAgent}${requestedSkillsBlock}`;
		addMessage('user', currentTask);
		if (activeTemplate) {
			addMessage('system', `Template: ${activeTemplate.name}`);
		}
		const selectedContexts = userContexts.filter((context) =>
			selectedUserContextIds.includes(context.id)
		);
		if (selectedContexts.length > 0) {
			addMessage(
				'system',
				`User context loaded: ${selectedContexts
					.map((context) => context.name)
					.join(', ')}`
			);
		}
		if (requestedSkills.length > 0) {
			addMessage(
				'system',
				`Skills loaded: ${requestedSkills.map((skill) => skill.name).join(', ')}`
			);
		}
		if (missing.length > 0) {
			addMessage(
				'system',
				`Requested skill(s) not found: ${missing.join(', ')}. Use @skill:SkillName with an existing skill name.`
			);
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
			releasePendingContinue();
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
			releasePendingContinue();
			setIsRunning(false);
		}
	};

	const runCurrentMode = () =>
		interactionMode === 'ask' ? runAsk(task) : runAgent(task);

	const addMessage = (
		role: 'user' | 'agent' | 'system',
		content: string,
		action?: Message['action']
	) => {
		setMessages((prev) => [...prev, { role, content, action }]);
	};

	const releasePendingContinue = () => {
		const resolve = continueResolverRef.current;
		continueResolverRef.current = null;
		if (resolve) resolve();
		setWaitingForUserAction(false);
	};

	const continueAfterUserAction = () => {
		releasePendingContinue();
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

	const zoomOut = () =>
		setUiZoom((prev) =>
			Math.max(
				uiZoomMin,
				Math.round((prev - uiZoomStep + Number.EPSILON) * 100) / 100
			)
		);

	const zoomIn = () =>
		setUiZoom((prev) =>
			Math.min(
				uiZoomMax,
				Math.round((prev + uiZoomStep + Number.EPSILON) * 100) / 100
			)
		);

	const activeTemplateDisplay = templates.find(
		(t) => t.id === activeTemplateId
	);
	const inputClass = isDark
		? 'w-full bg-gpt-surface border border-gpt-border rounded-xl px-3 py-2.5 text-[13px] text-gpt-text placeholder:text-gpt-muted focus:outline-none focus:ring-2 focus:ring-gpt-accent/20'
		: 'w-full bg-gpt-surface border border-gpt-border rounded-xl px-3 py-2.5 text-[13px] text-gpt-text placeholder:text-gpt-muted focus:outline-none focus:ring-2 focus:ring-gpt-accent/20';
	const panelClass = isDark
		? 'bg-gpt-surface/55 border border-gpt-border shadow-sm'
		: 'bg-gpt-surface/55 border border-gpt-border shadow-sm';
	const labelClass = isDark ? 'text-gpt-muted' : 'text-gpt-muted';
	const subtleClass = isDark ? 'text-gpt-muted' : 'text-gpt-muted';
	const secondaryButtonClass = isDark
		? 'bg-gpt-surface hover:bg-gpt-elevated text-gpt-text border border-gpt-border transition-colors'
		: 'bg-gpt-surface hover:bg-gpt-elevated text-gpt-text border border-gpt-border transition-colors';
	const iconButtonClass =
		'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gpt-muted hover:text-gpt-text hover:bg-gpt-surface transition-colors';
	const iconButtonActiveClass =
		'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gpt-surface text-gpt-text transition-colors';
	const uploadedAssets = assets.filter((asset) => asset.source !== 'generated');
	const agentCreatedAssets = assets.filter((asset) => asset.source === 'generated');
	const skills = [...userSkills, ...predefinedSkills];

	return {
		task,
		setTask,
		messages,
		setMessages,
		isRunning,
		setIsRunning,
		showSettings,
		setShowSettings,
		interactionMode,
		setInteractionMode,
		baseUrl,
		setBaseUrl,
		apiKey,
		setApiKey,
		modelName,
		setModelName,
		availableModels,
		setAvailableModels,
		useManualModel,
		setUseManualModel,
		supportsVision,
		setSupportsVision,
		maxSteps,
		setMaxSteps,
		requestTimeoutMs,
		setRequestTimeoutMs,
		stepDelayMs,
		setStepDelayMs,
		invalidRetryBaseMs,
		setInvalidRetryBaseMs,
		invalidRetryIncrementMs,
		setInvalidRetryIncrementMs,
		invalidRetryMaxMs,
		setInvalidRetryMaxMs,
		maxConsecutiveFailures,
		setMaxConsecutiveFailures,
		mcpServers,
		setMcpServers,
		showAddMcp,
		setShowAddMcp,
		mcpJsonInput,
		setMcpJsonInput,
		mcpInputError,
		setMcpInputError,
		mcpTestingById,
		setMcpTestingById,
		mcpTestResultById,
		setMcpTestResultById,
		templates,
		setTemplates,
		activeTemplateId,
		setActiveTemplateId,
		editingTemplateId,
		setEditingTemplateId,
		templateName,
		setTemplateName,
		templateContent,
		setTemplateContent,
		attachedFiles,
		setAttachedFiles,
		assets,
		setAssets,
		sessionLoaded,
		setSessionLoaded,
		sessionId,
		setSessionId,
		showTemplatePanel,
		setShowTemplatePanel,
		showHistoryPanel,
		setShowHistoryPanel,
		isModelSettingsOpen,
		setIsModelSettingsOpen,
		isMcpSettingsOpen,
		setIsMcpSettingsOpen,
		isAssetsSettingsOpen,
		setIsAssetsSettingsOpen,
		isAgentCreatedAssetsOpen,
		setIsAgentCreatedAssetsOpen,
		isUserContextSettingsOpen,
		setIsUserContextSettingsOpen,
		isSkillsSettingsOpen,
		setIsSkillsSettingsOpen,
		uiZoom,
		setUiZoom,
		isDark,
		setIsDark,
		showTemplateForm,
		setShowTemplateForm,
		openTemplateMenuId,
		setOpenTemplateMenuId,
		openMcpMenuId,
		setOpenMcpMenuId,
		openAssetMenuId,
		setOpenAssetMenuId,
		showAssetSuggestions,
		setShowAssetSuggestions,
		assetQuery,
		setAssetQuery,
		expandedAssetId,
		setExpandedAssetId,
		userSkills,
		setUserSkills,
		predefinedSkills,
		setPredefinedSkills,
		showSkillForm,
		setShowSkillForm,
		editingSkillId,
		setEditingSkillId,
		skillContent,
		setSkillContent,
		openSkillMenuId,
		setOpenSkillMenuId,
		userContexts,
		setUserContexts,
		selectedUserContextIds,
		setSelectedUserContextIds,
		showUserContextPicker,
		setShowUserContextPicker,
		showUserContextForm,
		setShowUserContextForm,
		editingUserContextId,
		setEditingUserContextId,
		userContextName,
		setUserContextName,
		userContextContent,
		setUserContextContent,
		openUserContextMenuId,
		setOpenUserContextMenuId,
		waitingForUserAction,
		setWaitingForUserAction,
		saveSettings,
		fetchModels,
		clearSession,
		addMcpServerFromJson,
		toggleMcpServer,
		removeMcpServer,
		confirmAndRemoveMcpServer,
		startEditMcpServer,
		testMcpServer,
		saveTemplate,
		startEditTemplate,
		clearTemplateEditor,
		deleteTemplateById,
		saveSkill,
		startEditSkill,
		clearSkillEditor,
		deleteSkillById,
		saveUserContext,
		startEditUserContext,
		clearUserContextEditor,
		deleteUserContextById,
		toggleSelectedUserContext,
		buildSelectedUserContextBlock,
		resolveRequestedSkillRefs,
		loadRequestedSkills,
		addAssets,
		removeAsset,
		confirmAndRemoveAsset,
		downloadAsset,
		addFiles,
		removeFile,
		startNewChat,
		buildFileContext,
		buildImageAttachments,
		buildAssetCatalog,
		runAgent,
		runAsk,
		runCurrentMode,
		addMessage,
		releasePendingContinue,
		continueAfterUserAction,
		computeAssetSuggestions,
		applyAssetMention,
		zoomOut,
		zoomIn,
		bottomRef,
		activeRef,
		inputRef,
		continueResolverRef,
		inputClass,
		panelClass,
		labelClass,
		subtleClass,
		secondaryButtonClass,
		iconButtonClass,
		iconButtonActiveClass,
		uploadedAssets,
		agentCreatedAssets,
		skills,
		activeTemplateDisplay,
	};
};

export type AgentAppModel = ReturnType<typeof useAgentApp>;

export default useAgentApp;
