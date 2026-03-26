import { useState, useEffect, useRef } from 'react';
import { AgentBrain } from './agent/brain';
import { parseAgentMessage } from './utils/parseAgentMessage';
import {
	createTabSessionManager,
	clearTabSessionState,
} from './agent/tabSessionManager';
import {
	parseMcpServersJsonInput,
	toMcpServersJsonText,
	type McpServerConfig,
} from './agent/mcpConfig';
import {
	buildMcpToolCatalogText,
	callMcpTool,
	listMcpTools,
	testMcpConnection,
} from './agent/mcpClient';

interface Message {
	role: 'user' | 'agent' | 'system';
	content: string;
	action?: 'continue_agent';
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
	source?: 'uploaded' | 'generated';
}

interface AgentSkill {
	id: string;
	name: string;
	content: string;
	source: 'user' | 'predefined';
	filePath?: string;
}

interface UserContextEntry {
	id: string;
	name: string;
	content: string;
}

const normalizeSkillKey = (value: string) =>
	value.toLowerCase().replace(/[^a-z0-9]/g, '');

const sessionIdKey = 'agent_active_session_id';
const getSessionMessagesKey = (sessionId: string) =>
	`agent_session_messages_${sessionId}`;
const assetsStorageKey = 'agent_assets_v1';
const mcpServersStorageKey = 'agent_mcp_servers';
const userSkillsStorageKey = 'agent_user_skills_v1';
const userContextsStorageKey = 'agent_user_contexts_v1';
const defaultSkillTemplate = `---
name: your-skill-name
description: what this skill does and when to use it
---

# Purpose



# When to use

- 

# Inputs

- 

# Steps

1. 

# Output



# Notes

- 
`;
const uiZoomStorageKey = 'agent_ui_zoom';
const uiZoomMin = 0.7;
const uiZoomMax = 1.8;
const uiZoomStep = 0.1;
const uiZoomDefault = 1;
const createSessionId = () =>
	`sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const resolveInitialSessionId = () => {
	const existing = localStorage.getItem(sessionIdKey);
	if (existing?.trim()) return existing;
	const next = createSessionId();
	localStorage.setItem(sessionIdKey, next);
	return next;
};

const iconStrokeClass = 'stroke-current';

const ZoomOutIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<circle className={iconStrokeClass} cx='11' cy='11' r='7' strokeWidth='1.8' />
		<path className={iconStrokeClass} d='M8.5 11h5' strokeWidth='1.8' strokeLinecap='round' />
		<path className={iconStrokeClass} d='M16.5 16.5L21 21' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

const ZoomInIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<circle className={iconStrokeClass} cx='11' cy='11' r='7' strokeWidth='1.8' />
		<path className={iconStrokeClass} d='M8.5 11h5' strokeWidth='1.8' strokeLinecap='round' />
		<path className={iconStrokeClass} d='M11 8.5v5' strokeWidth='1.8' strokeLinecap='round' />
		<path className={iconStrokeClass} d='M16.5 16.5L21 21' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

const TemplatesIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<rect className={iconStrokeClass} x='4' y='4' width='16' height='16' rx='3' strokeWidth='1.8' />
		<path className={iconStrokeClass} d='M8 9h8M8 12h8M8 15h5' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

const HistoryIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<path className={iconStrokeClass} d='M4 12a8 8 0 1 0 2.3-5.7' strokeWidth='1.8' strokeLinecap='round' />
		<path className={iconStrokeClass} d='M4 5v4h4' strokeWidth='1.8' strokeLinecap='round' />
		<path className={iconStrokeClass} d='M12 8v4l2.5 1.5' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

const NewChatIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<rect className={iconStrokeClass} x='4' y='4' width='16' height='16' rx='3' strokeWidth='1.8' />
		<path className={iconStrokeClass} d='M12 8v8M8 12h8' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

const SettingsIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<circle className={iconStrokeClass} cx='12' cy='12' r='2.4' strokeWidth='1.8' />
		<path
			className={iconStrokeClass}
			d='M19.2 12a7.4 7.4 0 0 0-.1-1.3l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.2 3h-4.4l-.3 2.5a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.5A7.4 7.4 0 0 0 4.8 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.3 2.5h4.4l.3-2.5a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z'
			strokeWidth='1.3'
			strokeLinecap='round'
		/>
	</svg>
);

const MoreVerticalIcon = () => (
	<svg viewBox='0 0 24 24' fill='currentColor' className='h-4 w-4 shrink-0'>
		<circle cx='12' cy='5' r='1.6' />
		<circle cx='12' cy='12' r='1.6' />
		<circle cx='12' cy='19' r='1.6' />
	</svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
	>
		<path
			className={iconStrokeClass}
			d='M6 9l6 6 6-6'
			strokeWidth='1.8'
			strokeLinecap='round'
			strokeLinejoin='round'
		/>
	</svg>
);

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

	const getSkillNameFromContent = (content: string) => {
		const raw = content.trim();
		if (!raw) return '';
		const nameMatch = raw.match(/^\s*name\s*:\s*(.+)$/im);
		if (nameMatch?.[1]) return nameMatch[1].trim();
		const headingMatch = raw.match(/^\s*#\s*(.+)$/m);
		if (headingMatch?.[1]) return headingMatch[1].trim();
		return '';
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

	const extractBase64FromDataUrl = (dataUrl: string) => {
		const commaIndex = dataUrl.indexOf(',');
		if (commaIndex === -1) return '';
		return dataUrl.slice(commaIndex + 1).trim();
	};

	const toBase64Utf8 = (text: string) => {
		const bytes = new TextEncoder().encode(text);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	};

	const toDataUrlFromBase64 = (base64: string, mimeType: string) =>
		`data:${mimeType || 'application/octet-stream'};base64,${base64}`;

	const decodeDataUrlText = (dataUrl: string) => {
		try {
			const base64 = extractBase64FromDataUrl(dataUrl);
			if (!base64) return '';
			const binary = atob(base64);
			const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
			return new TextDecoder().decode(bytes);
		} catch {
			return '';
		}
	};

	const normalizeAssetRef = (value: string) =>
		value.toLowerCase().replace(/[^a-z0-9]/g, '');

	const resolveAssetRef = (ref: string) => {
		const raw = ref.trim();
		if (!raw) return null;
		const lower = raw.toLowerCase();
		const normalized = normalizeAssetRef(raw);
		const exact = assets.find((asset) => asset.name.trim().toLowerCase() === lower);
		if (exact) return exact;
		const normalizedExact = assets.find(
			(asset) => normalizeAssetRef(asset.name) === normalized
		);
		if (normalizedExact) return normalizedExact;
		const partial = assets.filter((asset) =>
			normalizeAssetRef(asset.name).includes(normalized)
		);
		if (partial.length === 1) return partial[0];
		return null;
	};

	const enrichMcpArgumentsWithAssets = (rawArgs: Record<string, unknown>) => {
		const args = { ...rawArgs };
		const generatedAssets: AssetFile[] = [];
		const unresolvedRefs: string[] = [];
		const canonicalAttachments: Array<{
			filename: string;
			content: string;
			mimeType: string;
		}> = [];

		const addGeneratedAsset = (
			filename: string,
			mimeType: string,
			base64Content: string
		) => {
			const cleanName = String(filename || 'generated.txt').trim();
			const cleanMime = String(mimeType || 'text/plain').trim();
			const dataUrl = toDataUrlFromBase64(base64Content, cleanMime);
			generatedAssets.push({
				id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
				name: cleanName,
				type: cleanMime,
				size: Math.max(0, Math.floor((base64Content.length * 3) / 4)),
				dataUrl,
				source: 'generated',
			});
		};

		const addCanonicalAttachment = (
			filename: string,
			content: string,
			mimeType: string
		) => {
			const cleanFilename = String(filename || '').trim();
			const cleanContent = String(content || '').trim();
			const cleanMime = String(mimeType || 'application/octet-stream').trim();
			if (!cleanFilename || !cleanContent) return;
			canonicalAttachments.push({
				filename: cleanFilename,
				content: cleanContent,
				mimeType: cleanMime,
			});
		};

		const addAttachmentFromAsset = (
			asset: AssetFile,
			filenameOverride?: string,
			mimeTypeOverride?: string
		) => {
			addCanonicalAttachment(
				filenameOverride || asset.name,
				extractBase64FromDataUrl(asset.dataUrl),
				mimeTypeOverride || asset.type || 'application/octet-stream'
			);
		};

		const tryResolveRefFromObject = (item: Record<string, unknown>) => {
			const refKeys = ['assetName', 'asset', 'file', 'fileName', 'filename', 'name'];
			for (const key of refKeys) {
				if (typeof item[key] === 'string' && item[key]?.trim()) {
					return String(item[key]);
				}
			}
			return '';
		};

		const sourceAttachments = Array.isArray(args.attachments)
			? args.attachments
			: [];

		sourceAttachments.forEach((item: any) => {
			if (!item || typeof item !== 'object') return;
			const filename = String(item.filename || item.fileName || item.name || '').trim();
			const mimeType = String(item.mimeType || item.type || 'application/octet-stream').trim();
			const textContent = String(item.textContent || item.text || '').trim();
			const content = String(item.content || '').trim();
			if (textContent) {
				const generatedBase64 = toBase64Utf8(textContent);
				const generatedName = filename || 'generated.txt';
				const generatedMime = mimeType || 'text/plain';
				addGeneratedAsset(generatedName, generatedMime, generatedBase64);
				addCanonicalAttachment(generatedName, generatedBase64, generatedMime);
				return;
			}
			if (content) {
				addCanonicalAttachment(
					filename || 'attachment.bin',
					content,
					mimeType || 'application/octet-stream'
				);
				return;
			}
			const ref = tryResolveRefFromObject(item);
			if (ref) {
				const asset = resolveAssetRef(ref);
				if (!asset) {
					unresolvedRefs.push(ref);
					return;
				}
				addAttachmentFromAsset(asset, filename || undefined, mimeType || undefined);
			}
		});

		if (typeof args.assetName === 'string' && args.assetName.trim()) {
			const asset = resolveAssetRef(args.assetName);
			if (!asset) {
				unresolvedRefs.push(args.assetName);
			} else {
				addAttachmentFromAsset(asset);
			}
		}

		if (Array.isArray(args.generatedFiles)) {
			args.generatedFiles.forEach((item: any) => {
				if (!item || typeof item !== 'object') return;
				const filename = String(item.filename || item.name || 'generated.txt');
				const text = String(item.textContent || item.text || '').trim();
				if (!text) return;
				const mimeType = String(item.mimeType || 'text/plain');
				const content = toBase64Utf8(text);
				addGeneratedAsset(filename, mimeType, content);
				addCanonicalAttachment(filename, content, mimeType);
			});
		}

		if (generatedAssets.length > 0) {
			setAssets((prev) => [...prev, ...generatedAssets]);
		}

		const deduped = new Map<string, { filename: string; content: string; mimeType: string }>();
		canonicalAttachments.forEach((item) => {
			const key = `${item.filename}|${item.mimeType}|${item.content.length}`;
			if (!deduped.has(key)) deduped.set(key, item);
		});
		const finalAttachments = Array.from(deduped.values());

		if (unresolvedRefs.length > 0) {
			return {
				ok: false as const,
				error: `Missing assets referenced by MCP_CALL: ${Array.from(new Set(unresolvedRefs)).join(', ')}`,
			};
		}
		if (finalAttachments.some((item) => !item.content || item.content.trim().length === 0)) {
			return { ok: false as const, error: 'One or more attachments resolved with empty content.' };
		}

		const nextArgs = { ...args };
		if (finalAttachments.length > 0) {
			nextArgs.attachments = finalAttachments;
		}
		delete (nextArgs as any).generatedFiles;
		return {
			ok: true as const,
			args: nextArgs,
			attachmentSummary: finalAttachments
				.map(
					(item) =>
						`${item.filename} (${item.mimeType}, base64:${item.content.length})`
				)
				.join('; '),
		};
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
		const stripThinkBlocks = (input: string) =>
			input.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
		const collectBalancedObjects = (input: string) => {
			const found: string[] = [];
			let start = -1;
			let depth = 0;
			let inString = false;
			let escape = false;
			for (let i = 0; i < input.length; i++) {
				const ch = input[i];
				if (inString) {
					if (escape) {
						escape = false;
						continue;
					}
					if (ch === '\\') {
						escape = true;
						continue;
					}
					if (ch === '"') {
						inString = false;
					}
					continue;
				}
				if (ch === '"') {
					inString = true;
					continue;
				}
				if (ch === '{') {
					if (depth === 0) start = i;
					depth += 1;
				} else if (ch === '}') {
					if (depth > 0) depth -= 1;
					if (depth === 0 && start !== -1) {
						found.push(input.slice(start, i + 1));
						start = -1;
					}
				}
			}
			return found;
		};
		const extractBalancedObjectFrom = (input: string, startIndex: number) => {
			if (startIndex < 0 || startIndex >= input.length || input[startIndex] !== '{')
				return '';
			let depth = 0;
			let inString = false;
			let escape = false;
			for (let i = startIndex; i < input.length; i++) {
				const ch = input[i];
				if (inString) {
					if (escape) {
						escape = false;
						continue;
					}
					if (ch === '\\') {
						escape = true;
						continue;
					}
					if (ch === '"') inString = false;
					continue;
				}
				if (ch === '"') {
					inString = true;
					continue;
				}
				if (ch === '{') depth += 1;
				if (ch === '}') {
					depth -= 1;
					if (depth === 0) return input.slice(startIndex, i + 1);
				}
			}
			return '';
		};
		const extractObjectAroundAction = (input: string) => {
			const actionIndex = input.indexOf('"action"');
			if (actionIndex === -1) return '';
			let start = -1;
			let inString = false;
			let escape = false;
			for (let i = actionIndex; i >= 0; i--) {
				const ch = input[i];
				if (inString) {
					if (escape) {
						escape = false;
						continue;
					}
					if (ch === '\\') {
						escape = true;
						continue;
					}
					if (ch === '"') inString = false;
					continue;
				}
				if (ch === '"') {
					inString = true;
					continue;
				}
				if (ch === '{') {
					start = i;
					break;
				}
			}
			if (start === -1) return '';
			let depth = 0;
			inString = false;
			escape = false;
			for (let i = start; i < input.length; i++) {
				const ch = input[i];
				if (inString) {
					if (escape) {
						escape = false;
						continue;
					}
					if (ch === '\\') {
						escape = true;
						continue;
					}
					if (ch === '"') inString = false;
					continue;
				}
				if (ch === '"') {
					inString = true;
					continue;
				}
				if (ch === '{') depth += 1;
				if (ch === '}') {
					depth -= 1;
					if (depth === 0) return input.slice(start, i + 1);
				}
			}
			return '';
		};
		const fallbackParseByFields = (input: string) => {
			const actionMatch = input.match(/"action"\s*:\s*"([^"]+)"/i);
			if (!actionMatch?.[1]) return null;
			const action = actionMatch[1];
			const paramsKeyIndex = input.search(/"params"\s*:/i);
			if (paramsKeyIndex === -1) return { action, params: {} };
			const braceIndex = input.indexOf('{', paramsKeyIndex);
			if (braceIndex === -1) return { action, params: {} };
			const paramsRaw = extractBalancedObjectFrom(input, braceIndex);
			if (!paramsRaw) return { action, params: {} };
			const direct = tryParseJson(paramsRaw);
			if (direct && typeof direct === 'object') return { action, params: direct };
			const repaired = tryParseJson(repairJson(paramsRaw));
			if (repaired && typeof repaired === 'object') return { action, params: repaired };
			return { action, params: {} };
		};

		const cleanedRaw = stripThinkBlocks(raw);
		const candidates: string[] = [];
		const fenceMatches = cleanedRaw.matchAll(/```json\s*([\s\S]*?)\s*```/gi);
		for (const match of fenceMatches) {
			if (match[1]) candidates.push(match[1]);
		}
		candidates.push(...collectBalancedObjects(cleanedRaw));
		const aroundAction = extractObjectAroundAction(cleanedRaw);
		if (aroundAction) candidates.push(aroundAction);
		candidates.push(cleanedRaw);
		candidates.push(raw);

		for (const candidate of candidates) {
			const direct = tryParseJson(candidate);
			if (direct?.action) return direct;
			const repaired = tryParseJson(repairJson(candidate));
			if (repaired?.action) return repaired;
			const fallback = fallbackParseByFields(candidate);
			if (fallback?.action) return fallback;
		}
		const cleanedFallback = fallbackParseByFields(cleanedRaw);
		if (cleanedFallback?.action) return cleanedFallback;
		const rawFallback = fallbackParseByFields(raw);
		if (rawFallback?.action) return rawFallback;
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
			OPEN_NEW_TAB: 'OPEN_TAB',
			NEW_TAB: 'OPEN_TAB',
			OPEN_URL: 'NAVIGATE',
			CHANGE_TAB: 'SWITCH_TAB',
			FOCUS_TAB: 'SWITCH_TAB',
			CLOSE_CURRENT_TAB: 'CLOSE_TAB',
			CLOSE_OTHER_TABS: 'CLOSE_EXTRA_TABS',
			WAIT_FOR_USER: 'WAIT_FOR_USER_ACTION',
			WAIT_USER_ACTION: 'WAIT_FOR_USER_ACTION',
			WAIT_FOR_USER_INPUT: 'WAIT_FOR_USER_ACTION',
			TOOL_CALL: 'MCP_CALL',
			CALL_TOOL: 'MCP_CALL',
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
			'tabId',
			'urlContains',
			'background',
			'serverId',
			'tool',
			'arguments',
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
		if (params.tabId != null) {
			const nextTabId = Number(params.tabId);
			params.tabId = Number.isFinite(nextTabId) ? nextTabId : params.tabId;
		}
		if (params.index != null) {
			const nextIndex = Number(params.index);
			params.index = Number.isFinite(nextIndex) ? nextIndex : params.index;
		}
		if (params.background != null) {
			params.background = Boolean(params.background);
		}
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
				case 'OPEN_TAB':
					return typeof params.url === 'string' && params.url.trim()
						? ''
						: 'OPEN_TAB requires params.url';
				case 'SWITCH_TAB':
					return typeof params.tabId === 'number' ||
						typeof params.index === 'number' ||
						(typeof params.urlContains === 'string' &&
							params.urlContains.trim().length > 0)
						? ''
						: 'SWITCH_TAB requires params.tabId or params.index or params.urlContains';
				case 'CLOSE_TAB':
					return '';
				case 'CLOSE_EXTRA_TABS':
					return '';
				case 'WAIT_FOR_USER_ACTION':
					return '';
				case 'MCP_CALL':
					return typeof params.serverId === 'string' &&
						params.serverId.trim().length > 0 &&
						typeof params.tool === 'string' &&
						params.tool.trim().length > 0
						? ''
						: 'MCP_CALL requires params.serverId and params.tool';
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
							? normalized.params.arguments
							: {}
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

	const getCurrentTab = async () => {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		return tab;
	};

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

	if (showSettings) {
		return (
			<div
				className={`w-full h-screen p-4 font-sans overflow-y-auto ${
					isDark ? 'bg-gpt-canvas text-gpt-text' : 'bg-gpt-canvas text-gpt-text'
				}`}
				style={{ colorScheme: isDark ? 'dark' : 'light' }}
			>
				<h2 className='text-lg font-bold mb-4'>Agent Settings</h2>
				<div className='space-y-6'>
					<div className={`${panelClass} rounded-lg p-4`}>
						<button
							onClick={() => setIsModelSettingsOpen((v) => !v)}
							className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
						>
							<span>Model Settings</span>
							<ChevronIcon open={isModelSettingsOpen} />
						</button>
					{isModelSettingsOpen && (
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
											isDark ? 'text-gpt-text' : 'text-gpt-text'
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
											<div>
												<label className={`block text-xs mb-1 ${labelClass}`}>
													Max Consecutive Failures
												</label>
												<input
													type='number'
													min={1}
													className={inputClass}
													value={maxConsecutiveFailures}
													onChange={(e) => {
														const next = Number(e.target.value);
														setMaxConsecutiveFailures(
															Number.isFinite(next) ? next : 1
														);
													}}
												/>
											</div>
										</div>
							</div>
						</div>
					)}
					</div>

					<div className={`${panelClass} rounded-lg p-4`}>
						<button
							onClick={() => setIsMcpSettingsOpen((v) => !v)}
							className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
						>
							<span>MCP Servers</span>
							<ChevronIcon open={isMcpSettingsOpen} />
						</button>
						{isMcpSettingsOpen && (
						<div className='space-y-3'>
							<button
								onClick={() => {
									setShowAddMcp((v) => !v);
									setMcpInputError('');
									setMcpJsonInput(toMcpServersJsonText(mcpServers));
								}}
								className={`text-xs px-3 py-2 rounded border ${secondaryButtonClass}`}
							>
								Add MCP
							</button>
							{showAddMcp ? (
								<div className='space-y-2'>
									<textarea
										className={inputClass}
										rows={12}
										placeholder={`{\n  "mcpServers": {\n    "gmail-mcp-server": {\n      "url": "http://192.168.0.4:5000/sse",\n      "headers": {\n        "Authorization": "Bearer 123456"\n      }\n    }\n  }\n}`}
										value={mcpJsonInput}
										onChange={(e) => setMcpJsonInput(e.target.value)}
									/>
									<div className='flex items-center gap-2'>
										<button
											onClick={addMcpServerFromJson}
											className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'
										>
											Save MCP JSON
										</button>
										<button
											onClick={() => {
												setShowAddMcp(false);
												setMcpJsonInput('');
												setMcpInputError('');
											}}
											className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
										>
											Cancel
										</button>
									</div>
									{mcpInputError ? (
										<div className='text-xs text-gpt-danger'>{mcpInputError}</div>
									) : null}
								</div>
							) : null}

							{mcpServers.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>
									No MCP servers configured.
								</div>
							) : (
								<div className='space-y-2'>
									{mcpServers.map((server) => (
										<div
											key={server.id}
											className={`relative rounded px-2 py-2 text-xs border ${
												isDark
													? 'bg-gpt-surface border-gpt-border'
													: 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<div className='truncate'>
													<div className='font-semibold truncate'>{server.name}</div>
													<div className={subtleClass}>{server.url}</div>
													{mcpTestResultById[server.id] ? (
														<div
															className={`text-[11px] mt-1 ${
																mcpTestResultById[server.id]
																	.startsWith('Connected')
																	? 'text-gpt-success'
																	: 'text-gpt-danger'
															}`}
														>
															{mcpTestResultById[server.id]}
														</div>
													) : null}
												</div>
												<div className='flex items-center gap-2'>
													<button
														onClick={() => testMcpServer(server)}
														disabled={Boolean(mcpTestingById[server.id])}
														className={`text-xs px-2 py-1 rounded border ${secondaryButtonClass} disabled:opacity-60`}
														title='Test MCP connection'
													>
														{mcpTestingById[server.id] ? 'Testing...' : 'Test'}
													</button>
													<label
														className={`flex items-center gap-1 ${subtleClass}`}
														title='Enable or disable this MCP server'
													>
														<input
															type='checkbox'
															checked={server.enabled}
															onChange={() => toggleMcpServer(server.id)}
														/>
														Enabled
													</label>
													<button
														onClick={() =>
															setOpenMcpMenuId((prev) =>
																prev === server.id ? null : server.id
															)
														}
														className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
														title='Actions'
													>
														<MoreVerticalIcon />
													</button>
												</div>
											</div>
											{openMcpMenuId === server.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark
															? 'bg-gpt-surface border-gpt-border'
															: 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button
														onClick={() => {
															setOpenMcpMenuId(null);
															startEditMcpServer();
														}}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
													>
														Edit
													</button>
													<button
														onClick={() => confirmAndRemoveMcpServer(server)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'
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
						)}
					</div>

					<div className={`${panelClass} rounded-lg p-4`}>
						<button
							onClick={() => setIsAssetsSettingsOpen((v) => !v)}
							className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
						>
							<span>ASSETS</span>
							<ChevronIcon open={isAssetsSettingsOpen} />
						</button>
						{isAssetsSettingsOpen && (
						<div className='space-y-3'>
							<label
								className={`cursor-pointer text-xs ${
									isDark ? 'text-gpt-accent' : 'text-gpt-warning'
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
							{uploadedAssets.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No uploaded assets yet.</div>
							) : (
								<div className='space-y-2'>
									{uploadedAssets.map((asset) => (
										<div
											key={asset.id}
											className={`relative rounded px-2 py-2 text-xs ${
												isDark
													? 'bg-gpt-surface border border-gpt-border'
													: 'bg-gpt-canvas border border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<div className='truncate'>
													<div className='truncate'>{asset.name}</div>
													<div className={`${subtleClass} text-[11px]`}>
														{asset.type} | {asset.size} bytes | uploaded
													</div>
												</div>
												<div className='flex items-center gap-2'>
													<button
														onClick={() =>
															setOpenAssetMenuId((prev) =>
																prev === asset.id ? null : asset.id
															)
														}
														className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
														title='Actions'
													>
														<MoreVerticalIcon />
													</button>
												</div>
											</div>
											{openAssetMenuId === asset.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark
															? 'bg-gpt-surface border-gpt-border'
															: 'bg-gpt-surface border-gpt-border'
													}`}
												>
													{asset.type.startsWith('text/') && (
														<button
															onClick={() => {
																setExpandedAssetId((prev) =>
																	prev === asset.id ? null : asset.id
																);
																setOpenAssetMenuId(null);
															}}
															className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
														>
															{expandedAssetId === asset.id ? 'Hide' : 'View'}
														</button>
													)}
													<button
														onClick={() => downloadAsset(asset)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
													>
														Download
													</button>
													<button
														onClick={() => confirmAndRemoveAsset(asset)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'
													>
														Delete
													</button>
												</div>
											)}
											{expandedAssetId === asset.id ? (
												<pre
													className={`mt-2 p-2 rounded whitespace-pre-wrap break-words text-[11px] max-h-44 overflow-y-auto ${
														isDark
															? 'bg-gpt-overlay border border-gpt-border'
															: 'bg-gpt-surface border border-gpt-border'
													}`}
												>
													{decodeDataUrlText(asset.dataUrl)}
												</pre>
											) : null}
										</div>
									))}
								</div>
							)}
							<div className={`text-xs ${subtleClass}`}>
								Use @ to reference assets by name in tasks.
							</div>
						</div>
						)}
					</div>

					<div className={`${panelClass} rounded-lg p-4`}>
						<button
							onClick={() => setIsAgentCreatedAssetsOpen((v) => !v)}
							className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
						>
							<span>Agent Created Assets</span>
							<ChevronIcon open={isAgentCreatedAssetsOpen} />
						</button>
						{isAgentCreatedAssetsOpen && (
						<div className='space-y-3'>
							{agentCreatedAssets.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>
									No agent-created assets yet.
								</div>
							) : (
								<div className='space-y-2'>
									{agentCreatedAssets.map((asset) => (
										<div
											key={asset.id}
											className={`relative rounded px-2 py-2 text-xs ${
												isDark
													? 'bg-gpt-surface border border-gpt-border'
													: 'bg-gpt-canvas border border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<div className='truncate'>
													<div className='truncate'>{asset.name}</div>
													<div className={`${subtleClass} text-[11px]`}>
														{asset.type} | {asset.size} bytes | generated
													</div>
												</div>
												<div className='flex items-center gap-2'>
													<button
														onClick={() =>
															setOpenAssetMenuId((prev) =>
																prev === asset.id ? null : asset.id
															)
														}
														className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
														title='Actions'
													>
														<MoreVerticalIcon />
													</button>
												</div>
											</div>
											{openAssetMenuId === asset.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark
															? 'bg-gpt-surface border-gpt-border'
															: 'bg-gpt-surface border-gpt-border'
													}`}
												>
													{asset.type.startsWith('text/') && (
														<button
															onClick={() => {
																setExpandedAssetId((prev) =>
																	prev === asset.id ? null : asset.id
																);
																setOpenAssetMenuId(null);
															}}
															className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
														>
															{expandedAssetId === asset.id ? 'Hide' : 'View'}
														</button>
													)}
													<button
														onClick={() => downloadAsset(asset)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
													>
														Download
													</button>
													<button
														onClick={() => confirmAndRemoveAsset(asset)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'
													>
														Delete
													</button>
												</div>
											)}
											{expandedAssetId === asset.id ? (
												<pre
													className={`mt-2 p-2 rounded whitespace-pre-wrap break-words text-[11px] max-h-44 overflow-y-auto ${
														isDark
															? 'bg-gpt-overlay border border-gpt-border'
															: 'bg-gpt-surface border border-gpt-border'
													}`}
												>
													{decodeDataUrlText(asset.dataUrl)}
												</pre>
											) : null}
										</div>
									))}
								</div>
							)}
						</div>
						)}
					</div>

					<div className={`${panelClass} rounded-lg p-4`}>
						<button
							onClick={() => setIsUserContextSettingsOpen((v) => !v)}
							className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
						>
							<span>User Context</span>
							<ChevronIcon open={isUserContextSettingsOpen} />
						</button>
						{isUserContextSettingsOpen && (
						<div className='space-y-3'>
							<div className='flex items-center justify-between gap-2'>
								<div className={`text-xs ${subtleClass}`}>
									Create reusable identity/context blocks.
								</div>
								<button
									onClick={() => {
										clearUserContextEditor();
										setShowUserContextForm(true);
									}}
									className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
								>
									Add Context
								</button>
							</div>
							{userContexts.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No user context yet.</div>
							) : (
								<div className='space-y-2'>
									{userContexts.map((context) => (
										<div
											key={context.id}
											className={`relative rounded px-2 py-2 text-xs border ${
												isDark
													? 'bg-gpt-surface border-gpt-border'
													: 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-start justify-between gap-2'>
												<div className='min-w-0'>
													<div className='font-semibold truncate'>{context.name}</div>
													<div className={`${subtleClass} line-clamp-2`}>
														{context.content}
													</div>
												</div>
												<button
													onClick={() =>
														setOpenUserContextMenuId((prev) =>
															prev === context.id ? null : context.id
														)
													}
													className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
													title='Actions'
												>
													<MoreVerticalIcon />
												</button>
											</div>
											{openUserContextMenuId === context.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark
															? 'bg-gpt-surface border-gpt-border'
															: 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button
														onClick={() => startEditUserContext(context.id)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
													>
														Edit
													</button>
													<button
														onClick={() => deleteUserContextById(context.id)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'
													>
														Delete
													</button>
												</div>
											)}
										</div>
									))}
								</div>
							)}
							{showUserContextForm && (
								<div className='space-y-2'>
									<input
										className={inputClass}
										value={userContextName}
										onChange={(e) => setUserContextName(e.target.value)}
										placeholder='Context name or identity'
									/>
									<textarea
										className={inputClass}
										rows={8}
										value={userContextContent}
										onChange={(e) => setUserContextContent(e.target.value)}
										placeholder='Context content'
									/>
									<div className='flex items-center gap-2'>
										<button
											onClick={saveUserContext}
											className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'
										>
											{editingUserContextId ? 'Update Context' : 'Save Context'}
										</button>
										<button
											onClick={clearUserContextEditor}
											className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
										>
											Cancel
										</button>
									</div>
								</div>
							)}
						</div>
						)}
					</div>

					<div className={`${panelClass} rounded-lg p-4`}>
						<button
							onClick={() => setIsSkillsSettingsOpen((v) => !v)}
							className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
						>
							<span>Skills</span>
							<ChevronIcon open={isSkillsSettingsOpen} />
						</button>
						{isSkillsSettingsOpen && (
						<div className='space-y-3'>
							<div className='flex items-center justify-between gap-2'>
								<div className={`text-xs ${subtleClass}`}>
									Use in task: <span className='text-gpt-text'>@skill:SkillName</span>
								</div>
								<button
									onClick={() => {
										clearSkillEditor();
										setShowSkillForm(true);
									}}
									className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
								>
									New Skill
								</button>
							</div>
							{skills.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No skills yet.</div>
							) : (
								<div className='space-y-2'>
									{skills.map((skill) => (
										<div
											key={skill.id}
											className={`relative rounded px-2 py-2 text-xs border ${
												isDark
													? 'bg-gpt-surface border-gpt-border'
													: 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-start justify-between gap-2'>
												<div className='min-w-0'>
													<div className='font-semibold truncate'>{skill.name}</div>
													<div className={`${subtleClass} line-clamp-2`}>
														{skill.source === 'predefined'
															? `Predefined file skill (${skill.filePath || 'SKILL.md'})`
															: skill.content}
													</div>
												</div>
												{skill.source === 'user' && (
													<button
														onClick={() =>
															setOpenSkillMenuId((prev) =>
																prev === skill.id ? null : skill.id
															)
														}
														className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
														title='Actions'
													>
														<MoreVerticalIcon />
													</button>
												)}
											</div>
											{skill.source === 'user' && openSkillMenuId === skill.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark
															? 'bg-gpt-surface border-gpt-border'
															: 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button
														onClick={() => startEditSkill(skill.id)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
													>
														Edit
													</button>
													<button
														onClick={() => deleteSkillById(skill.id)}
														className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'
													>
														Delete
													</button>
												</div>
											)}
										</div>
									))}
								</div>
							)}
							{showSkillForm && (
								<div className='space-y-2'>
									<textarea
										className={inputClass}
										rows={12}
										value={skillContent}
										onChange={(e) => setSkillContent(e.target.value)}
										placeholder='Write skill template...'
									/>
									<div className='flex items-center gap-2'>
										<button
											onClick={saveSkill}
											className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'
										>
											{editingSkillId ? 'Update Skill' : 'Save Skill'}
										</button>
										<button
											onClick={clearSkillEditor}
											className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
										>
											Cancel
										</button>
									</div>
								</div>
							)}
						</div>
						)}
					</div>

					<div className='flex gap-2 pt-2'>
						<button
							onClick={saveSettings}
							className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-4 py-2 text-sm flex-1'
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
			className={`w-full h-screen flex flex-col navai-shell ${
				isDark ? 'bg-gpt-canvas text-gpt-text' : 'bg-gpt-canvas text-gpt-text'
			}`}
			style={{ colorScheme: isDark ? 'dark' : 'light' }}
		>
			<div
				className={`navai-topbar px-4 py-3 border-b ${
					isDark
						? 'border-gpt-border bg-gpt-sidebar'
						: 'border-gpt-border bg-gpt-surface'
				} flex justify-between items-center`}
			>
				<div className='flex items-center gap-3'>
					<div
						className={`w-3 h-3 rounded-full ${
							isRunning
								? 'bg-gpt-accent animate-pulse'
								: isDark
								? 'bg-gpt-muted'
								: 'bg-gpt-muted'
						}`}
					></div>
					<h1 className='navai-title text-gpt-text'>
						NavAI
					</h1>
				</div>
				<div className='flex gap-2'>
					<button
						onClick={zoomOut}
						className={iconButtonClass}
						title='Zoom out'
						aria-label='Zoom out'
					>
						<ZoomOutIcon />
					</button>
					<button
						onClick={zoomIn}
						className={iconButtonClass}
						title='Zoom in'
						aria-label='Zoom in'
					>
						<ZoomInIcon />
					</button>
					{isRunning && (
						<button
							onClick={() =>
								(window as any).stopAgent && (window as any).stopAgent()
							}
							className='inline-flex h-10 shrink-0 px-3 items-center justify-center rounded-xl bg-gpt-danger-soft text-gpt-danger hover:bg-gpt-danger-soft/80 transition-colors text-xs font-medium'
						>
							STOP
						</button>
					)}
					<button
						onClick={() => setShowTemplatePanel((v) => !v)}
						className={showTemplatePanel ? iconButtonActiveClass : iconButtonClass}
						title='Templates'
						aria-label='Templates'
					>
						<TemplatesIcon />
					</button>
					<button
						onClick={() => setShowHistoryPanel((v) => !v)}
						className={showHistoryPanel ? iconButtonActiveClass : iconButtonClass}
						title='History'
						aria-label='History'
					>
						<HistoryIcon />
					</button>
					<button
						onClick={startNewChat}
						className={iconButtonClass}
						title='New chat'
						aria-label='New chat'
					>
						<NewChatIcon />
					</button>
					<button
						onClick={() => setShowSettings(true)}
						className={iconButtonClass}
						title='Settings'
						aria-label='Settings'
					>
						<SettingsIcon />
					</button>
				</div>
			</div>

			<div className='flex-1 flex min-h-0' style={{ zoom: uiZoom }}>
				<div className='flex-1 flex flex-col min-w-0'>
					<div className='flex-1 overflow-y-auto'>
						<div className='navai-feed space-y-4'>
							{messages.map((m, i) => (
							<div
								key={i}
								className={`flex ${
									m.role === 'user' ? 'justify-end' : 'justify-start'
								}`}
							>
								<div
									className={`max-w-[86%] rounded-2xl px-4 py-3 text-[13px] leading-6 whitespace-pre-wrap ${
										m.role === 'user'
											? isDark
												? 'bg-gpt-user text-gpt-text border border-gpt-border/60'
												: 'bg-gpt-accent text-gpt-on-accent'
											: m.role === 'agent'
											? isDark
												? 'bg-gpt-surface border border-gpt-border text-gpt-text'
												: 'bg-gpt-surface border border-gpt-border'
											: isDark
											? 'text-gpt-muted text-xs bg-gpt-sidebar/50 border border-gpt-border/40'
											: 'text-gpt-muted text-xs bg-gpt-surface/60'
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
																	isDark ? 'text-gpt-muted' : 'text-gpt-muted'
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
																				: 'border-gpt-border bg-gpt-surface/35'
																		}`}
																	>
																		<summary
																			className={`cursor-pointer text-xs select-none ${
																				isDark
																					? 'text-gpt-muted'
																					: 'text-gpt-muted'
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
																				: 'border-gpt-border bg-gpt-surface/35'
																		}`}
																	>
																		<div
																			className={`text-xs mb-1 ${
																				isDark
																					? 'text-gpt-muted'
																					: 'text-gpt-muted'
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
																									: 'text-gpt-muted'
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
																		: 'text-gpt-accent hover:text-gpt-accent-hover'
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
									{m.action === 'continue_agent' && (
										<button
											onClick={continueAfterUserAction}
											disabled={!waitingForUserAction}
											className='mt-3 rounded-lg bg-gpt-accent px-3 py-1.5 text-xs font-medium text-gpt-on-accent transition-colors hover:bg-gpt-accent-hover disabled:opacity-60 disabled:cursor-not-allowed'
										>
											Continue
										</button>
									)}
								</div>
							</div>
							))}
							<div ref={bottomRef} />
						</div>
					</div>

					<div
						className={`px-4 py-3 border-t ${
							isDark
								? 'border-gpt-border bg-gpt-canvas'
								: 'border-gpt-border bg-gpt-surface'
						}`}
					>
						<div className='navai-composer-shell'>
						<div
							className={`flex items-center justify-between text-xs mb-2 ${
								isDark ? 'text-gpt-muted' : 'text-gpt-muted'
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
										: 'text-gpt-accent hover:text-gpt-accent-hover'
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
												: 'bg-gpt-canvas border border-gpt-border'
										}`}
									>
										<span
											className={isDark ? 'text-gpt-text' : 'text-gpt-text'}
										>
											{file.name}
										</span>
										<button
											onClick={() => removeFile(file.id)}
											className='text-gpt-danger hover:text-gpt-danger'
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
										? 'bg-gpt-accent text-gpt-on-accent border-gpt-accent'
										: isDark
										? 'border-gpt-border text-gpt-muted hover:text-gpt-text'
										: 'border-gpt-border text-gpt-muted hover:text-gpt-text'
								}`}
							>
								Agent
							</button>
							<button
								onClick={() => setInteractionMode('ask')}
								disabled={isRunning}
								className={`text-xs px-3 py-1 rounded-full border ${
									interactionMode === 'ask'
										? 'bg-gpt-accent text-gpt-on-accent border-gpt-accent'
										: isDark
										? 'border-gpt-border text-gpt-muted hover:text-gpt-text'
										: 'border-gpt-border text-gpt-muted hover:text-gpt-text'
								}`}
							>
								Ask
							</button>
							<button
								onClick={() => setShowUserContextPicker((prev) => !prev)}
								disabled={userContexts.length === 0}
								className={`text-xs px-3 py-1 rounded-full border ${
									showUserContextPicker
										? 'bg-gpt-accent text-gpt-on-accent border-gpt-accent'
										: 'border-gpt-border text-gpt-muted hover:text-gpt-text'
								} ${userContexts.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
							>
								Context ({selectedUserContextIds.length})
							</button>
						</div>
						{showUserContextPicker && (
							<div
								className={`mb-3 rounded-lg border p-2 text-xs ${
									isDark
										? 'border-gpt-border bg-gpt-surface'
										: 'border-gpt-border bg-gpt-surface'
								}`}
							>
								{userContexts.length === 0 ? (
									<div className={subtleClass}>No user context available.</div>
								) : (
									<div className='space-y-1'>
										{userContexts.map((context) => (
											<label
												key={context.id}
												className='flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-gpt-elevated'
											>
												<input
													type='checkbox'
													checked={selectedUserContextIds.includes(context.id)}
													onChange={() => toggleSelectedUserContext(context.id)}
												/>
												<span className='truncate'>{context.name}</span>
											</label>
										))}
									</div>
								)}
							</div>
						)}
						<div className='flex gap-2 items-end rounded-3xl border border-gpt-border bg-gpt-surface px-2 py-2 shadow-sm transition-colors focus-within:border-gpt-accent/60 focus-within:ring-1 focus-within:ring-gpt-accent/25'>
							<textarea
								ref={inputRef}
								className={`flex-1 resize-none bg-transparent px-3 py-2 text-[14px] leading-6 focus:outline-none transition-all ${
									isDark
										? 'text-gpt-text placeholder:text-gpt-muted'
										: 'text-gpt-text placeholder:text-gpt-muted'
								}`}
								rows={2}
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
								onKeyDown={(e) => {
									if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isRunning) {
										e.preventDefault();
										runCurrentMode();
									}
								}}
							/>
							<button
								disabled={isRunning}
								onClick={runCurrentMode}
								className='bg-gpt-accent hover:bg-gpt-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-gpt-on-accent rounded-full px-4 py-2 text-sm font-medium transition-all'
							>
								{isRunning ? '…' : interactionMode === 'ask' ? 'Ask' : 'Go'}
							</button>
						</div>
						{showAssetSuggestions && assets.length > 0 && (
							<div
								className={`mt-2 rounded-lg border text-xs ${
									isDark
										? 'border-gpt-border bg-gpt-sidebar'
										: 'border-gpt-border bg-gpt-surface'
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
												isDark ? 'hover:bg-gpt-surface' : 'hover:bg-gpt-surface'
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
								isDark ? 'text-gpt-muted' : 'text-gpt-muted'
							}`}
						>
							Model: {modelName} | Mode: {interactionMode === 'ask' ? 'Ask' : 'Agent'}
						</div>
						</div>
					</div>
				</div>

				{(showTemplatePanel || showHistoryPanel) && (
					<div
						className={`w-72 border-l ${
							isDark
								? 'border-gpt-border bg-gpt-sidebar'
								: 'border-gpt-border bg-gpt-surface'
						} p-3 space-y-3 overflow-y-auto`}
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
												: 'text-gpt-success border-gpt-success/60'
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
																: 'border-gpt-border bg-gpt-surface/35'
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
																	isDark ? 'text-gpt-muted' : 'text-gpt-muted'
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
																	: 'border-gpt-border text-gpt-muted hover:text-gpt-text'
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
																		: 'bg-gpt-surface border-gpt-border'
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
																			: 'hover:bg-gpt-surface'
																	}`}
																>
																	Edit
																</button>
																<button
																	onClick={() => deleteTemplateById(t.id)}
																	className={`block w-full text-left px-2 py-1 rounded ${
																		isDark
																			? 'text-gpt-danger hover:bg-gpt-elevated'
																			: 'text-gpt-danger hover:bg-gpt-surface'
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
															: 'bg-gpt-surface border border-gpt-border'
													}`}
													value={templateContent}
													onChange={(e) => setTemplateContent(e.target.value)}
													placeholder='Add system-level instructions or constraints...'
												/>
											</div>
											<div className='flex gap-2'>
												<button
													onClick={saveTemplate}
													className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-4 py-2 text-sm flex-1'
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
										isDark ? 'text-gpt-text' : 'text-gpt-muted'
									}`}
								>
									Session History
								</div>
								<div className='flex items-center justify-between'>
									<div
										className={`text-xs ${
											isDark ? 'text-gpt-muted' : 'text-gpt-muted'
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






