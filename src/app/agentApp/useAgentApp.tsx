import { useState, useEffect, useRef } from 'react';
import { OpenAiAgentBrain } from '../../agent/brain';
import createStreamingBrain from '../../agent/createStreamingBrain';
import parseHfRepoId from '../../agent/parseHfRepoId';
import normalizeGgufHfFilePathInput from '../normalizeGgufHfFilePathInput';
import validateFullHfGgufFileUrl from '../validateFullHfGgufFileUrl';
import getDefaultWebGpuContextWindowTokens from '../getDefaultWebGpuContextWindowTokens';
import normalizeModelConfigs from '../normalizeModelConfigs';
import normalizeWebGpuContextWindowTokens from '../normalizeWebGpuContextWindowTokens';
import formatModelLoadError from '../formatModelLoadError';
import deleteModelBlob from '../modelBlobDb/deleteModelBlob';
import putModelBlob from '../modelBlobDb/putModelBlob';
import testWebGpuModel from '../model/testWebGpuModel';
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
import type { ModelConfig } from '../types/ModelConfig';
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
	modelConfigsStorageKey,
	activeModelIdStorageKey,
} from '../agentStorageConstants';
import getSessionMessagesKey from '../getSessionMessagesKey';
import createSessionId from '../createSessionId';
import resolveInitialSessionId from '../resolveInitialSessionId';
import normalizeSkillKey from '../normalizeSkillKey';
import defaultSkillTemplate from '../defaultSkillTemplate';
import {
	parseAgentDecisions,
} from '../agentDecision/parseAgentDecision';
import normalizeDecision from '../agentDecision/normalizeDecision';
import validateActionPayload from '../agentDecision/validateActionPayload';
import buildElementMapSummary from '../agentDecision/buildElementMapSummary';
import hashString from '../agentDecision/hashString';
import resolveClickFallbackUrl from '../agentDecision/resolveClickFallbackUrl';
import captureVisibleTab from '../chrome/captureVisibleTab';
import executeTabActionInFrames from '../chrome/executeTabActionInFrames';
import getTabStateFromFrames from '../chrome/getTabStateFromFrames';
import resolveAgentTab from '../chrome/resolveAgentTab';
import readFileAsText from '../file/readFileAsText';
import readFileAsDataUrl from '../file/readFileAsDataUrl';
import getSkillNameFromContent from '../getSkillNameFromContent';
import enrichMcpArgumentsWithAssets from '../mcp/enrichMcpArgumentsWithAssets';
import resolveRequestedMcpRefs from '../resolveRequestedMcpRefs';
import resolveRequestedAssetRefs from '../resolveRequestedAssetRefs';
import summarizeSession from '../summarizeSession';
import testModelConnection from '../model/testModelConnection';

type SettingsTransferCategory =
	| 'models'
	| 'runtime'
	| 'mcpServers'
	| 'userContexts'
	| 'templates'
	| 'skills';

const settingsTransferDefaultSelection: Record<SettingsTransferCategory, boolean> =
	{
		models: true,
		runtime: true,
		mcpServers: true,
		userContexts: true,
		templates: true,
		skills: true,
	};

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

	// Model Configs State
	const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(() => {
		try {
			const raw = localStorage.getItem(modelConfigsStorageKey);
			if (!raw) return [];
			return normalizeModelConfigs(JSON.parse(raw));
		} catch {
			return [];
		}
	});
	const [activeModelId, setActiveModelId] = useState(
		() => localStorage.getItem(activeModelIdStorageKey) || ''
	);
	const [showModelForm, setShowModelForm] = useState(false);
	const [editingModelId, setEditingModelId] = useState<string | null>(null);
	const [modelFormName, setModelFormName] = useState('');
	const [modelFormBaseUrl, setModelFormBaseUrl] = useState('http://localhost:11434/v1');
	const [modelFormApiKey, setModelFormApiKey] = useState('');
	const [modelFormModelName, setModelFormModelName] = useState('');
	const [modelFormSupportsVision, setModelFormSupportsVision] = useState(false);
	const [modelFormUseManual, setModelFormUseManual] = useState(false);
	const [modelFormAvailableModels, setModelFormAvailableModels] = useState<string[]>([]);
	const [modelFormTab, setModelFormTab] = useState<'api' | 'webgpu'>('api');
	const [modelFormWebGpuBackend, setModelFormWebGpuBackend] = useState<'onnx' | 'gguf'>('onnx');
	const [modelFormWebGpuSource, setModelFormWebGpuSource] = useState<
		'hf' | 'upload' | 'url'
	>('hf');
	const [modelFormWebGpuHfOnnx, setModelFormWebGpuHfOnnx] = useState(
		'onnx-community/Qwen3-0.6B-ONNX'
	);
	const [modelFormWebGpuHfGgufRepo, setModelFormWebGpuHfGgufRepo] = useState('');
	const [modelFormWebGpuHfGgufFile, setModelFormWebGpuHfGgufFile] = useState('');
	const [modelFormWebGpuGgufUrl, setModelFormWebGpuGgufUrl] = useState('');
	const [modelFormGgufConfigError, setModelFormGgufConfigError] = useState('');
	const [modelFormWebGpuUpload, setModelFormWebGpuUpload] = useState<File | null>(null);
	const [modelFormWebGpuContextWindowTokens, setModelFormWebGpuContextWindowTokens] =
		useState<number>(() => getDefaultWebGpuContextWindowTokens());
	const [webGpuSaving, setWebGpuSaving] = useState(false);
	const [showDiscardDialog, setShowDiscardDialog] = useState(false);
	const [memoryEnabled, setMemoryEnabled] = useState(
		() => localStorage.getItem('agent_memory_enabled') !== 'false'
	);
	const [isMemorySettingsOpen, setIsMemorySettingsOpen] = useState(false);
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
	const [modelTestingById, setModelTestingById] = useState<
		Record<string, boolean>
	>({});
	const [modelTestResultById, setModelTestResultById] = useState<
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
	const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
		null
	);
	const [templateName, setTemplateName] = useState('');
	const [templateContent, setTemplateContent] = useState('');
	const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
	const [assets, setAssets] = useState<AssetFile[]>([]);
	const [sessionLoaded, setSessionLoaded] = useState(false);
	const [sessionId, setSessionId] = useState(() => resolveInitialSessionId());
	const [showTemplatePicker, setShowTemplatePicker] = useState(false);
	const [showMcpPicker, setShowMcpPicker] = useState(false);
	const [showSkillsPicker, setShowSkillsPicker] = useState(false);
	const [showAssetsPicker, setShowAssetsPicker] = useState(false);
	const [showHistoryPanel, setShowHistoryPanel] = useState(false);
	const [isModelsSettingsOpen, setIsModelsSettingsOpen] = useState(false);
	const [isRuntimeControlsOpen, setIsRuntimeControlsOpen] = useState(false);
	const [isPromptTemplatesSettingsOpen, setIsPromptTemplatesSettingsOpen] = useState(false);
	const [isMcpSettingsOpen, setIsMcpSettingsOpen] = useState(false);
	const [isAssetsSettingsOpen, setIsAssetsSettingsOpen] = useState(false);
	const [isAgentCreatedAssetsOpen, setIsAgentCreatedAssetsOpen] = useState(
		false
	);
	const [isUserContextSettingsOpen, setIsUserContextSettingsOpen] = useState(
		false
	);
	const [isSkillsSettingsOpen, setIsSkillsSettingsOpen] = useState(false);
	const [isSettingsTransferOpen, setIsSettingsTransferOpen] = useState(false);
	const [settingsTransferSelection, setSettingsTransferSelection] = useState<
		Record<SettingsTransferCategory, boolean>
	>(settingsTransferDefaultSelection);
	const [settingsTransferJson, setSettingsTransferJson] = useState('');
	const [settingsTransferStatus, setSettingsTransferStatus] = useState('');
	const [uiZoom, setUiZoom] = useState(() => {
		const raw = Number(localStorage.getItem(uiZoomStorageKey));
		if (!Number.isFinite(raw)) return uiZoomDefault;
		return Math.max(uiZoomMin, Math.min(uiZoomMax, raw));
	});
	const [isDark, setIsDark] = useState(true);
	const [showTemplateForm, setShowTemplateForm] = useState(false);
	const [openModelMenuId, setOpenModelMenuId] = useState<string | null>(null);
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
	const [autoScrollEnabled, setAutoScrollEnabled] = useState(
		() => localStorage.getItem('agent_auto_scroll_enabled') !== 'false'
	);
	const [openUserContextMenuId, setOpenUserContextMenuId] = useState<
		string | null
	>(null);

	const bottomRef = useRef<HTMLDivElement>(null);
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const activeRef = useRef(true);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const continueResolverRef = useRef<(() => void) | null>(null);
	const [waitingForUserAction, setWaitingForUserAction] = useState(false);

	const activeModelConfig = modelConfigs.find(m => m.id === activeModelId) ?? modelConfigs[0] ?? null;

	useEffect(() => {
		if (!autoScrollEnabled) return;
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, autoScrollEnabled]);

	useEffect(() => {
		localStorage.setItem('agent_auto_scroll_enabled', String(autoScrollEnabled));
	}, [autoScrollEnabled]);

	const isNearBottom = (el: HTMLElement) =>
		el.scrollHeight - (el.scrollTop + el.clientHeight) <= 24;

	const handleMessagesScroll = () => {
		const container = messagesContainerRef.current;
		if (!container) return;
		const shouldEnable = isNearBottom(container);
		setAutoScrollEnabled((prev) => (prev === shouldEnable ? prev : shouldEnable));
	};

	const toggleAutoScroll = () => {
		setAutoScrollEnabled((prev) => {
			const next = !prev;
			if (next) {
				requestAnimationFrame(() => {
					bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
				});
			}
			return next;
		});
	};

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
		localStorage.setItem(modelConfigsStorageKey, JSON.stringify(modelConfigs));
	}, [modelConfigs]);

	useEffect(() => {
		localStorage.setItem(activeModelIdStorageKey, activeModelId);
	}, [activeModelId]);

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

	const saveSettings = () => {
		localStorage.setItem('agent_memory_enabled', String(memoryEnabled));
		localStorage.setItem('agent_max_steps', String(Math.max(1, Math.floor(maxSteps))));
		localStorage.setItem('agent_request_timeout_ms', String(Math.max(1000, Math.floor(requestTimeoutMs))));
		localStorage.setItem('agent_step_delay_ms', String(Math.max(0, Math.floor(stepDelayMs))));
		localStorage.setItem('agent_invalid_retry_base_ms', String(Math.max(0, Math.floor(invalidRetryBaseMs))));
		localStorage.setItem('agent_invalid_retry_increment_ms', String(Math.max(0, Math.floor(invalidRetryIncrementMs))));
		localStorage.setItem('agent_invalid_retry_max_ms', String(Math.max(0, Math.floor(invalidRetryMaxMs))));
		localStorage.setItem('agent_max_consecutive_failures', String(Math.max(1, Math.floor(maxConsecutiveFailures))));
		setShowSettings(false);
		setShowDiscardDialog(false);
		addMessage(
			'system',
			`Settings Saved.${
				activeModelConfig
					? ` Model: ${
							activeModelConfig.kind === 'api'
								? activeModelConfig.modelName
								: activeModelConfig.backend === 'onnx'
									? activeModelConfig.source.type === 'huggingface'
										? activeModelConfig.source.repoId
										: activeModelConfig.source.fileName
									: activeModelConfig.source.type === 'huggingface'
										? `${activeModelConfig.source.repoId}/${activeModelConfig.source.fileName}`
										: activeModelConfig.source.fileName
						}`
					: ''
			}`
		);
	};

	const fetchModelsForForm = async () => {
		const url = modelFormBaseUrl.trim();
		if (!url) return;
		const models = await OpenAiAgentBrain.fetchModels(url, modelFormApiKey);
		if (models.length > 0) setModelFormAvailableModels(models);
	};

	const saveModelConfig = async () => {
		const name = modelFormName.trim();
		if (!name) return;
		if (editingModelId) {
			const existingEdit = modelConfigs.find((m) => m.id === editingModelId);
			if (existingEdit?.kind === 'api' && modelFormTab !== 'api') return;
			if (existingEdit?.kind === 'webgpu' && modelFormTab !== 'webgpu') return;
		}
		if (modelFormTab === 'api') {
			const baseUrl = modelFormBaseUrl.trim();
			const modelName = modelFormModelName.trim();
			if (!baseUrl || !modelName) return;
			if (editingModelId) {
				setModelConfigs((prev) =>
					prev.map((m) =>
						m.id === editingModelId && m.kind === 'api'
							? {
									...m,
									name,
									baseUrl,
									apiKey: modelFormApiKey,
									modelName,
									supportsVision: modelFormSupportsVision,
								}
							: m
					)
				);
			} else {
				const id = `model_${Date.now()}_${Math.random().toString(36).slice(2)}`;
				const newConfig: ModelConfig = {
					kind: 'api',
					id,
					name,
					baseUrl,
					apiKey: modelFormApiKey,
					modelName,
					supportsVision: modelFormSupportsVision,
				};
				setModelConfigs((prev) => [...prev, newConfig]);
				if (!activeModelId) setActiveModelId(id);
			}
			clearModelForm();
			return;
		}
		setWebGpuSaving(true);
		try {
			if (editingModelId) {
				const existing = modelConfigs.find((m) => m.id === editingModelId);
				if (existing?.kind === 'webgpu') {
					setModelConfigs((prev) =>
						prev.map((m) =>
							m.id === editingModelId && m.kind === 'webgpu'
								? {
										...m,
										name,
										supportsVision: modelFormSupportsVision,
										contextWindowTokens: normalizeWebGpuContextWindowTokens(
											modelFormWebGpuContextWindowTokens,
											m.backend === 'onnx' ? 'onnx' : 'gguf'
										),
									}
								: m
						)
					);
					clearModelForm();
					return;
				}
			}
			const id = `model_${Date.now()}_${Math.random().toString(36).slice(2)}`;
			if (modelFormWebGpuBackend === 'onnx') {
				if (modelFormWebGpuSource === 'hf') {
					const repoId = parseHfRepoId(modelFormWebGpuHfOnnx);
					if (!repoId) return;
					const newConfig: ModelConfig = {
						kind: 'webgpu',
						id,
						name,
						backend: 'onnx',
						supportsVision: modelFormSupportsVision,
						contextWindowTokens: normalizeWebGpuContextWindowTokens(
							modelFormWebGpuContextWindowTokens,
							'onnx'
						),
						source: { type: 'huggingface', repoId },
					};
					setModelConfigs((prev) => [...prev, newConfig]);
				} else {
					const file = modelFormWebGpuUpload;
					if (!file) return;
					const blobId = `blob_${id}_onnx`;
					await putModelBlob(blobId, file);
					const newConfig: ModelConfig = {
						kind: 'webgpu',
						id,
						name,
						backend: 'onnx',
						supportsVision: modelFormSupportsVision,
						contextWindowTokens: normalizeWebGpuContextWindowTokens(
							modelFormWebGpuContextWindowTokens,
							'onnx'
						),
						source: {
							type: 'upload',
							fileName: file.name,
							blobId,
							byteSize: file.size,
						},
					};
					setModelConfigs((prev) => [...prev, newConfig]);
				}
			} else {
				if (modelFormWebGpuSource === 'hf') {
					const repoId = parseHfRepoId(modelFormWebGpuHfGgufRepo);
					const fileName = normalizeGgufHfFilePathInput(modelFormWebGpuHfGgufFile);
					if (!repoId || !fileName) return;
					if (!fileName.toLowerCase().endsWith('.gguf')) {
						setModelFormGgufConfigError(
							'Enter the repo-relative path to a .gguf file (not only the repo name).'
						);
						return;
					}
					setModelFormGgufConfigError('');
					const newConfig: ModelConfig = {
						kind: 'webgpu',
						id,
						name,
						backend: 'gguf',
						supportsVision: modelFormSupportsVision,
						contextWindowTokens: normalizeWebGpuContextWindowTokens(
							modelFormWebGpuContextWindowTokens,
							'gguf'
						),
						source: { type: 'huggingface', repoId, fileName },
					};
					setModelConfigs((prev) => [...prev, newConfig]);
				} else if (modelFormWebGpuSource === 'url') {
					const v = validateFullHfGgufFileUrl(modelFormWebGpuGgufUrl);
					if (!v.ok) {
						setModelFormGgufConfigError(v.message);
						return;
					}
					setModelFormGgufConfigError('');
					const parsed = v.parsed;
					const newConfig: ModelConfig = {
						kind: 'webgpu',
						id,
						name,
						backend: 'gguf',
						supportsVision: modelFormSupportsVision,
						contextWindowTokens: normalizeWebGpuContextWindowTokens(
							modelFormWebGpuContextWindowTokens,
							'gguf'
						),
						source: {
							type: 'huggingface',
							repoId: parsed.repoId,
							fileName: parsed.fileName,
						},
					};
					setModelConfigs((prev) => [...prev, newConfig]);
				} else {
					const file = modelFormWebGpuUpload;
					if (!file) return;
					const blobId = `blob_${id}_gguf`;
					await putModelBlob(blobId, file);
					const newConfig: ModelConfig = {
						kind: 'webgpu',
						id,
						name,
						backend: 'gguf',
						supportsVision: modelFormSupportsVision,
						contextWindowTokens: normalizeWebGpuContextWindowTokens(
							modelFormWebGpuContextWindowTokens,
							'gguf'
						),
						source: {
							type: 'upload',
							fileName: file.name,
							blobId,
							byteSize: file.size,
						},
					};
					setModelConfigs((prev) => [...prev, newConfig]);
				}
			}
			if (!activeModelId) setActiveModelId(id);
			clearModelForm();
		} finally {
			setWebGpuSaving(false);
		}
	};

	const startEditModelConfig = (id: string) => {
		const config = modelConfigs.find((m) => m.id === id);
		if (!config) return;
		setModelFormGgufConfigError('');
		setEditingModelId(config.id);
		setModelFormName(config.name);
		if (config.kind === 'api') {
			setModelFormTab('api');
			setModelFormBaseUrl(config.baseUrl);
			setModelFormApiKey(config.apiKey);
			setModelFormModelName(config.modelName);
			setModelFormSupportsVision(config.supportsVision);
			setModelFormUseManual(false);
			setModelFormAvailableModels([]);
		} else {
			setModelFormTab('webgpu');
			setModelFormWebGpuBackend(config.backend);
			setModelFormWebGpuContextWindowTokens(
				normalizeWebGpuContextWindowTokens(
					config.contextWindowTokens,
					config.backend === 'onnx' ? 'onnx' : 'gguf'
				)
			);
			if (config.backend === 'onnx') {
				setModelFormSupportsVision(config.supportsVision);
				if (config.source.type === 'huggingface') {
					setModelFormWebGpuSource('hf');
					setModelFormWebGpuHfOnnx(config.source.repoId);
				} else {
					setModelFormWebGpuSource('upload');
					setModelFormWebGpuUpload(null);
				}
			} else {
				setModelFormSupportsVision(config.supportsVision);
				if (config.source.type === 'huggingface') {
					setModelFormWebGpuSource('hf');
					setModelFormWebGpuHfGgufRepo(config.source.repoId);
					setModelFormWebGpuHfGgufFile(config.source.fileName);
					setModelFormWebGpuGgufUrl('');
				} else {
					setModelFormWebGpuSource('upload');
					setModelFormWebGpuUpload(null);
					setModelFormWebGpuGgufUrl('');
				}
			}
		}
		setShowModelForm(true);
	};

	const clearModelForm = () => {
		setEditingModelId(null);
		setModelFormTab('api');
		setModelFormName('');
		setModelFormBaseUrl('http://localhost:11434/v1');
		setModelFormApiKey('');
		setModelFormModelName('');
		setModelFormSupportsVision(false);
		setModelFormUseManual(false);
		setModelFormAvailableModels([]);
		setModelFormWebGpuBackend('onnx');
		setModelFormWebGpuSource('hf');
		setModelFormWebGpuHfOnnx('onnx-community/Qwen3-0.6B-ONNX');
		setModelFormWebGpuHfGgufRepo('');
		setModelFormWebGpuHfGgufFile('');
		setModelFormWebGpuGgufUrl('');
		setModelFormGgufConfigError('');
		setModelFormWebGpuUpload(null);
		setModelFormWebGpuContextWindowTokens(getDefaultWebGpuContextWindowTokens());
		setShowModelForm(false);
	};

	const deleteModelConfigById = async (id: string) => {
		const config = modelConfigs.find((m) => m.id === id);
		if (!config) return;
		const ok = window.confirm(`Delete model "${config.name}"?\nThis action cannot be undone.`);
		if (!ok) return;
		if (config.kind === 'webgpu') {
			if (config.backend === 'onnx' && config.source.type === 'upload') {
				await deleteModelBlob(config.source.blobId);
			}
			if (config.backend === 'gguf' && config.source.type === 'upload') {
				await deleteModelBlob(config.source.blobId);
			}
		}
		const remaining = modelConfigs.filter((m) => m.id !== id);
		setModelConfigs(remaining);
		if (activeModelId === id) setActiveModelId(remaining[0]?.id ?? '');
	};

	const testModelConfigById = async (id: string) => {
		const config = modelConfigs.find((item) => item.id === id);
		if (!config) return;
		setModelTestingById((prev) => ({ ...prev, [id]: true }));
		setModelTestResultById((prev) => ({ ...prev, [id]: '' }));
		if (config.kind === 'api') {
			const result = await testModelConnection({
				baseUrl: config.baseUrl,
				apiKey: config.apiKey,
				modelName: config.modelName,
			});
			setModelTestResultById((prev) => ({ ...prev, [id]: result.message }));
		} else {
			const result = await testWebGpuModel(config, requestTimeoutMs);
			setModelTestResultById((prev) => ({ ...prev, [id]: result.message }));
		}
		setModelTestingById((prev) => ({ ...prev, [id]: false }));
	};

	const hasUnsavedRuntimeChanges = () => {
		const g = (key: string, fb: string) => Number(localStorage.getItem(key) || fb) || Number(fb);
		const savedMemory = localStorage.getItem('agent_memory_enabled') !== 'false';
		return (
			memoryEnabled !== savedMemory ||
			maxSteps !== g('agent_max_steps', '30') ||
			requestTimeoutMs !== g('agent_request_timeout_ms', '900000') ||
			stepDelayMs !== g('agent_step_delay_ms', '1500') ||
			invalidRetryBaseMs !== g('agent_invalid_retry_base_ms', '500') ||
			invalidRetryIncrementMs !== g('agent_invalid_retry_increment_ms', '500') ||
			invalidRetryMaxMs !== g('agent_invalid_retry_max_ms', '5000') ||
			maxConsecutiveFailures !== g('agent_max_consecutive_failures', '3')
		);
	};

	const attemptLeaveSettings = () => {
		if (hasUnsavedRuntimeChanges()) {
			setShowDiscardDialog(true);
			return;
		}
		setShowSettings(false);
	};

	const confirmDiscardSettings = () => {
		const g = (key: string, fb: string) => Number(localStorage.getItem(key) || fb) || Number(fb);
		setMemoryEnabled(localStorage.getItem('agent_memory_enabled') !== 'false');
		setMaxSteps(g('agent_max_steps', '30'));
		setRequestTimeoutMs(g('agent_request_timeout_ms', '900000'));
		setStepDelayMs(g('agent_step_delay_ms', '1500'));
		setInvalidRetryBaseMs(g('agent_invalid_retry_base_ms', '500'));
		setInvalidRetryIncrementMs(g('agent_invalid_retry_increment_ms', '500'));
		setInvalidRetryMaxMs(g('agent_invalid_retry_max_ms', '5000'));
		setMaxConsecutiveFailures(g('agent_max_consecutive_failures', '3'));
		setShowDiscardDialog(false);
		setShowSettings(false);
	};

	const toggleSettingsTransferCategory = (category: SettingsTransferCategory) => {
		setSettingsTransferSelection((prev) => ({
			...prev,
			[category]: !prev[category],
		}));
	};

	const exportSettingsJson = (mode: 'all' | 'selected') => {
		const selected =
			mode === 'all'
				? settingsTransferDefaultSelection
				: settingsTransferSelection;
		const payload: Record<string, unknown> = {
			schema: 'navai-settings-v1',
			exportedAt: new Date().toISOString(),
			data: {},
		};
		const data = payload.data as Record<string, unknown>;
		if (selected.models) {
			data.models = modelConfigs.map((m) =>
				m.kind === 'api'
					? {
							kind: 'api' as const,
							name: m.name,
							baseUrl: m.baseUrl,
							modelName: m.modelName,
							supportsVision: Boolean(m.supportsVision),
						}
					: m.backend === 'onnx'
						? {
								kind: 'webgpu' as const,
								backend: 'onnx' as const,
								name: m.name,
								supportsVision: Boolean(m.supportsVision),
								contextWindowTokens: m.contextWindowTokens,
								source:
									m.source.type === 'huggingface'
										? { type: 'huggingface' as const, repoId: m.source.repoId }
										: {
												type: 'upload' as const,
												fileName: m.source.fileName,
												byteSize: m.source.byteSize,
											},
							}
						: {
								kind: 'webgpu' as const,
								backend: 'gguf' as const,
								name: m.name,
								supportsVision: Boolean(m.supportsVision),
								contextWindowTokens: m.contextWindowTokens,
								source:
									m.source.type === 'huggingface'
										? {
												type: 'huggingface' as const,
												repoId: m.source.repoId,
												fileName: m.source.fileName,
											}
										: {
												type: 'upload' as const,
												fileName: m.source.fileName,
												byteSize: m.source.byteSize,
											},
							}
			);
		}
		if (selected.runtime) {
			data.runtime = {
				memoryEnabled: Boolean(memoryEnabled),
				maxSteps: Math.max(1, Math.floor(maxSteps)),
				requestTimeoutMs: Math.max(1000, Math.floor(requestTimeoutMs)),
				stepDelayMs: Math.max(0, Math.floor(stepDelayMs)),
				invalidRetryBaseMs: Math.max(0, Math.floor(invalidRetryBaseMs)),
				invalidRetryIncrementMs: Math.max(0, Math.floor(invalidRetryIncrementMs)),
				invalidRetryMaxMs: Math.max(0, Math.floor(invalidRetryMaxMs)),
				maxConsecutiveFailures: Math.max(
					1,
					Math.floor(maxConsecutiveFailures)
				),
			};
		}
		if (selected.mcpServers) {
			data.mcpServers = mcpServers.map((server) => ({
				name: server.name,
				url: server.url,
				enabled: server.enabled !== false,
				headers: server.headers || {},
			}));
		}
		if (selected.userContexts) {
			data.userContexts = userContexts.map((context) => ({
				name: context.name,
				content: context.content,
			}));
		}
		if (selected.templates) {
			data.templates = {
				items: templates.map((template) => ({
					name: template.name,
					content: template.content,
				})),
			};
		}
		if (selected.skills) {
			data.skills = userSkills.map((skill) => ({
				name: skill.name,
				content: skill.content,
			}));
		}

		const text = JSON.stringify(payload, null, 2);
		const blob = new Blob([text], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `navai-settings-${Date.now()}.json`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		setSettingsTransferStatus('Settings exported.');
	};

	const loadSettingsTransferFile = async (fileList: FileList | null) => {
		const file = fileList?.[0];
		if (!file) return;
		const text = await file.text();
		setSettingsTransferJson(text);
		setSettingsTransferStatus('Loaded JSON file. Ready to import.');
	};

	const importSettingsJson = () => {
		const raw = settingsTransferJson.trim();
		if (!raw) {
			setSettingsTransferStatus('Paste or load a JSON payload first.');
			return;
		}
		try {
			const parsed = JSON.parse(raw);
			const baseData =
				parsed &&
				typeof parsed === 'object' &&
				parsed.data &&
				typeof parsed.data === 'object'
					? parsed.data
					: parsed;
			const data = baseData as Record<string, any>;
			const selected = settingsTransferSelection;
			const report: string[] = [];

			if (selected.models && Array.isArray(data.models)) {
				const genId = () =>
					`model_${Date.now()}_${Math.random().toString(36).slice(2)}`;
				const existing = new Set(modelConfigs.map((m) => JSON.stringify(m)));
				let added = 0;
				const next = [...modelConfigs];
				for (const item of data.models) {
					if (!item || typeof item !== 'object') continue;
					const name = String((item as any).name || '').trim();
					if (!name) continue;
					if ((item as any).kind === 'webgpu') {
						const w = item as any;
						if (w.backend === 'onnx' && w.source?.type === 'huggingface') {
							const hfRepo = String(w.source.repoId || '').trim();
							if (!hfRepo) continue;
							const entry: ModelConfig = {
								kind: 'webgpu',
								id: genId(),
								name,
								backend: 'onnx',
								supportsVision: Boolean(w.supportsVision),
								contextWindowTokens: normalizeWebGpuContextWindowTokens(
									w.contextWindowTokens,
									'onnx'
								),
								source: {
									type: 'huggingface',
									repoId: hfRepo,
								},
							};
							const key = JSON.stringify(entry);
							if (existing.has(key)) continue;
							existing.add(key);
							next.push(entry);
							added += 1;
						} else if (w.backend === 'gguf' && w.source?.type === 'huggingface') {
							const repoId = String(w.source.repoId || '').trim();
							const fileName = String(w.source.fileName || '').trim();
							if (!repoId || !fileName) continue;
							const entry: ModelConfig = {
								kind: 'webgpu',
								id: genId(),
								name,
								backend: 'gguf',
								supportsVision: Boolean(w.supportsVision),
								contextWindowTokens: normalizeWebGpuContextWindowTokens(
									w.contextWindowTokens,
									'gguf'
								),
								source: { type: 'huggingface', repoId, fileName },
							};
							const key = JSON.stringify(entry);
							if (existing.has(key)) continue;
							existing.add(key);
							next.push(entry);
							added += 1;
						}
						continue;
					}
					const baseUrl = String((item as any).baseUrl || '').trim();
					const modelName = String((item as any).modelName || '').trim();
					const supportsVision = Boolean((item as any).supportsVision);
					if (!baseUrl || !modelName) continue;
					const entry: ModelConfig = {
						kind: 'api',
						id: genId(),
						name,
						baseUrl,
						apiKey: '',
						modelName,
						supportsVision,
					};
					const key = JSON.stringify(entry);
					if (existing.has(key)) continue;
					existing.add(key);
					next.push(entry);
					added += 1;
				}
				if (added > 0) {
					setModelConfigs(next);
					if (!activeModelId && next[0]?.id) setActiveModelId(next[0].id);
				}
				report.push(`Models +${added}`);
			}

			if (selected.runtime && data.runtime && typeof data.runtime === 'object') {
				const runtime = data.runtime as Record<string, unknown>;
				const toNumber = (value: unknown, fallback: number) => {
					const next = Number(value);
					return Number.isFinite(next) ? next : fallback;
				};
				setMemoryEnabled(
					typeof runtime.memoryEnabled === 'boolean'
						? runtime.memoryEnabled
						: memoryEnabled
				);
				setMaxSteps(Math.max(1, Math.floor(toNumber(runtime.maxSteps, maxSteps))));
				setRequestTimeoutMs(
					Math.max(
						1000,
						Math.floor(toNumber(runtime.requestTimeoutMs, requestTimeoutMs))
					)
				);
				setStepDelayMs(
					Math.max(0, Math.floor(toNumber(runtime.stepDelayMs, stepDelayMs)))
				);
				setInvalidRetryBaseMs(
					Math.max(
						0,
						Math.floor(toNumber(runtime.invalidRetryBaseMs, invalidRetryBaseMs))
					)
				);
				setInvalidRetryIncrementMs(
					Math.max(
						0,
						Math.floor(
							toNumber(
								runtime.invalidRetryIncrementMs,
								invalidRetryIncrementMs
							)
						)
					)
				);
				setInvalidRetryMaxMs(
					Math.max(
						0,
						Math.floor(toNumber(runtime.invalidRetryMaxMs, invalidRetryMaxMs))
					)
				);
				setMaxConsecutiveFailures(
					Math.max(
						1,
						Math.floor(
							toNumber(
								runtime.maxConsecutiveFailures,
								maxConsecutiveFailures
							)
						)
					)
				);
				report.push('Runtime updated');
			}

			if (selected.mcpServers) {
				const importedList = Array.isArray(data.mcpServers)
					? data.mcpServers
					: data.mcpServers && typeof data.mcpServers === 'object'
					? Object.entries(data.mcpServers).map(([name, cfg]) => ({
							name,
							...(cfg as object),
					  }))
					: [];
				if (importedList.length > 0) {
					const normalizeHeaders = (headers: unknown) => {
						const src =
							headers && typeof headers === 'object'
								? (headers as Record<string, unknown>)
								: {};
						return Object.keys(src)
							.sort()
							.reduce<Record<string, string>>((acc, key) => {
								const value = src[key];
								if (typeof value === 'string') acc[key] = value;
								return acc;
							}, {});
					};
					const fingerprint = (item: {
						name: string;
						url: string;
						enabled: boolean;
						headers: Record<string, string>;
					}) =>
						`${item.name}|${item.url}|${item.enabled ? '1' : '0'}|${JSON.stringify(
							item.headers
						)}`;
					const existing = new Set(
						mcpServers.map((server) =>
							fingerprint({
								name: server.name.trim(),
								url: server.url.trim(),
								enabled: server.enabled !== false,
								headers: normalizeHeaders(server.headers),
							})
						)
					);
					let added = 0;
					const next = [...mcpServers];
					for (const item of importedList) {
						const name = String((item as any)?.name || '').trim();
						const url = String((item as any)?.url || '').trim();
						if (!name || !url) continue;
						const enabled = (item as any)?.enabled !== false;
						const headers = normalizeHeaders((item as any)?.headers);
						const key = fingerprint({ name, url, enabled, headers });
						if (existing.has(key)) continue;
						existing.add(key);
						next.push({
							id: `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
							name,
							url,
							enabled,
							headers,
						});
						added += 1;
					}
					if (added > 0) setMcpServers(next);
					report.push(`MCP +${added}`);
				}
			}

			if (selected.userContexts && Array.isArray(data.userContexts)) {
				const fingerprint = (item: { name: string; content: string }) =>
					`${item.name.trim()}|${item.content.trim()}`;
				const existing = new Set(
					userContexts.map((context) =>
						fingerprint({ name: context.name, content: context.content })
					)
				);
				let added = 0;
				const next = [...userContexts];
				for (const item of data.userContexts) {
					const name = String(item?.name || '').trim();
					const content = String(item?.content || '').trim();
					if (!name || !content) continue;
					const key = fingerprint({ name, content });
					if (existing.has(key)) continue;
					existing.add(key);
					next.push({
						id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
						name,
						content,
					});
					added += 1;
				}
				if (added > 0) setUserContexts(next);
				report.push(`Contexts +${added}`);
			}

			if (selected.templates) {
				const templateSection =
					data.templates && typeof data.templates === 'object'
						? data.templates
						: null;
				const templateItems = Array.isArray((templateSection as any)?.items)
					? (templateSection as any).items
					: Array.isArray(data.templates)
					? data.templates
					: [];
				if (templateItems.length > 0) {
					const fingerprint = (item: { name: string; content: string }) =>
						`${item.name.trim()}|${item.content.trim()}`;
					const existing = new Set(
						templates.map((template) =>
							fingerprint({ name: template.name, content: template.content })
						)
					);
					let added = 0;
					const next = [...templates];
					for (const item of templateItems) {
						const name = String(item?.name || '').trim();
						const content = String(item?.content || '').trim();
						if (!name || !content) continue;
						const key = fingerprint({ name, content });
						if (existing.has(key)) continue;
						existing.add(key);
						next.push({
							id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`,
							name,
							content,
						});
						added += 1;
					}
					if (added > 0) setTemplates(next);
					report.push(`Templates +${added}`);
				}
			}

			if (selected.skills && Array.isArray(data.skills)) {
				const fingerprint = (item: { name: string; content: string }) =>
					`${item.name.trim()}|${item.content.trim()}`;
				const existing = new Set(
					userSkills.map((skill) =>
						fingerprint({ name: skill.name, content: skill.content })
					)
				);
				let added = 0;
				const next = [...userSkills];
				for (const item of data.skills) {
					const name = String(item?.name || '').trim();
					const content = String(item?.content || '').trim();
					if (!name || !content) continue;
					const key = fingerprint({ name, content });
					if (existing.has(key)) continue;
					existing.add(key);
					next.push({
						id: `skill_${Date.now()}_${Math.random().toString(36).slice(2)}`,
						name,
						content,
						source: 'user',
					});
					added += 1;
				}
				if (added > 0) setUserSkills(next);
				report.push(`Skills +${added}`);
			}

			setSettingsTransferStatus(
				report.length > 0
					? `Import complete. ${report.join(' | ')}`
					: 'Import complete. No selected sections were changed.'
			);
		} catch (e: any) {
			setSettingsTransferStatus(
				`Import failed: ${e?.message || 'Invalid JSON format'}`
			);
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
		if (editingTemplateId === id) clearTemplateEditor();
		setOpenTemplateMenuId(null);
	};

	const appendTemplateToTask = (id: string) => {
		const template = templates.find((item) => item.id === id);
		if (!template) return;
		const content = template.content.trim();
		if (!content) return;
		setTask((prev) => {
			const head = prev.trimEnd();
			return head.length > 0 ? `${head}\n\n${content}` : content;
		});
		setShowTemplatePicker(false);
		requestAnimationFrame(() => {
			inputRef.current?.focus();
		});
	};

	const appendRefToTask = (value: string) => {
		const trimmed = value.trim();
		if (!trimmed) return;
		setTask((prev) => {
			const head = prev.trimEnd();
			return head.length > 0 ? `${head} ${trimmed} ` : `${trimmed} `;
		});
		requestAnimationFrame(() => {
			inputRef.current?.focus();
		});
	};

	const appendMcpRefToTask = (name: string) =>
		appendRefToTask(`@mcp:${name}`);
	const appendSkillRefToTask = (name: string) =>
		appendRefToTask(`@skill:${name}`);
	const appendAssetRefToTask = (name: string) =>
		appendRefToTask(`@asset:${name}`);

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
		const tags = Array.from(text.matchAll(/@skill:([^\s,;\[\]]+)/gi))
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
		const baseTaskForAgentRaw = currentTask;
		const userContextBlock = buildSelectedUserContextBlock();
		const baseTaskForAgent = `${baseTaskForAgentRaw}${userContextBlock}`;
		const {
			requestedServers: requestedMcpServers,
			missing: missingMcp,
			disabled: disabledMcp,
		} = resolveRequestedMcpRefs(baseTaskForAgent, mcpServers);
		const { requestedAssets, missing: missingAssets } = resolveRequestedAssetRefs(
			baseTaskForAgent,
			assets
		);
		const { requestedSkills, missing } = await loadRequestedSkills(baseTaskForAgent);
		const requestedSkillsBlock =
			requestedSkills.length > 0
				? `\n\nREQUESTED SKILLS (load only these):\n${requestedSkills
						.map((skill) => `Skill: ${skill.name}\n${skill.content}`)
						.join('\n\n')}`
				: '';
		const requestedAssetsBlock =
			requestedAssets.length > 0
				? `\n\nREQUESTED ASSETS (focus these names):\n${requestedAssets
						.map(
							(asset) =>
								`${asset.name} (${asset.type}, ${asset.size} bytes, ${asset.source || 'uploaded'})`
						)
						.join('\n')}`
				: '';
		const taskForAgent = `${baseTaskForAgent}${requestedSkillsBlock}${requestedAssetsBlock}`;
		addMessage('user', currentTask);
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
		if (requestedAssets.length > 0) {
			addMessage(
				'system',
				`Assets in scope: ${requestedAssets.map((asset) => asset.name).join(', ')}`
			);
		}
		if (missingAssets.length > 0) {
			addMessage(
				'system',
				`Requested asset(s) not found: ${missingAssets.join(', ')}. Use @asset:AssetName with an existing asset name.`
			);
		}
		if (requestedMcpServers.length > 0) {
			addMessage(
				'system',
				`MCP in scope: ${requestedMcpServers.map((s) => s.name).join(', ')}`
			);
		}
		if (missingMcp.length > 0) {
			addMessage(
				'system',
				`Requested MCP server(s) not found: ${missingMcp.join(', ')}. Use @mcp:ServerName matching a configured MCP JSON key.`
			);
		}
		if (disabledMcp.length > 0) {
			addMessage(
				'system',
				`MCP server(s) disabled in settings: ${disabledMcp.join(', ')}. Enable them or remove @mcp: references.`
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
		const runtimeMaxBatchActions = 10;

		const modelCfg = activeModelConfig;
		if (!modelCfg) {
			addMessage('system', 'No model configured. Add a model in settings first.');
			setIsRunning(false);
			return;
		}
		const supportsVision = modelCfg.supportsVision;
		let brain: Awaited<ReturnType<typeof createStreamingBrain>>;
		try {
			brain = await createStreamingBrain(modelCfg, {
				requestTimeoutMs: runtimeRequestTimeoutMs,
			});
		} catch (e: any) {
			addMessage('system', `Could not load model: ${formatModelLoadError(e)}`);
			setIsRunning(false);
			return;
		}
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
		const enabledMcpServers = mcpServers.filter((server) => server.enabled);
		const allowedMcpServerIds = new Set(enabledMcpServers.map((s) => s.id));
		const mcpTools = await listMcpTools(enabledMcpServers);
		const mcpCatalog = buildMcpToolCatalogText(mcpTools);
		activeRef.current = true;
		(window as any).stopAgent = () => {
			activeRef.current = false;
			releasePendingContinue();
			setIsRunning(false);
		};
		const waitForManualFix = async (reason: string, hints: string[] = []) => {
			const hintsText =
				hints.length > 0
					? `\nSuggested checks:\n${hints.map((hint) => `- ${hint}`).join('\n')}`
					: '';
			setWaitingForUserAction(true);
			addMessage(
				'system',
				`Agent paused: ${reason}${hintsText}\nClick Continue when done.`,
				'continue_agent'
			);
			await new Promise<void>((resolve) => {
				continueResolverRef.current = resolve;
			});
			continueResolverRef.current = null;
			setWaitingForUserAction(false);
			if (!activeRef.current) return false;
			addMessage('system', 'User continued the task.');
			return true;
		};

		try {
			const { tab: initialTab, openedNewTab } = await resolveAgentTab();
			if (!initialTab?.id) throw new Error('No active tab');
			if (openedNewTab) {
				addMessage('system', 'Opened a new browser tab to start the task.');
			}
			await tabSession.beginRun(initialTab.id);
			shouldRestoreMainTab = true;

			while (activeRef.current && stepCount < runtimeMaxSteps) {
				const tabId = await tabSession.ensureCurrentTabActive();
				if (!tabId) throw new Error('No managed tab available');

				let state: any = null;
				try {
					state = await getTabStateFromFrames(tabId);
				} catch {
					const resumed = await waitForManualFix(
						'Could not connect to the current page content.',
						[
							'Refresh the page once.',
							'Make sure you are on a normal web page (http/https).',
							'If login/captcha is blocking progress, complete it manually.',
						]
					);
					if (!resumed) break;
					stepCount++;
					continue;
				}

				if (!state) {
					const resumed = await waitForManualFix(
						'Page content could not be read from the current tab.',
						[
							'Scroll or interact once on the page to make it active.',
							'Refresh and then click Continue.',
						]
					);
					if (!resumed) break;
					stepCount++;
					continue;
				}

				if (!activeRef.current) break;

				const tabContext = await tabSession.buildTabContext();
				const pageHash = hashString(state.content || '');
				pageHistory.push(pageHash);
				if (pageHistory.length > 6) pageHistory.shift();

				const screenshot = supportsVision ? await captureVisibleTab() : null;
				const elementMap = buildElementMapSummary(state.elements || []);

				let fullText = '';
				let contextOverflow = false;
				try {
					const stream = brain.processStep({
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
					});

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
				} catch (ctxErr: any) {
					contextOverflow = true;
					const errMsg = (ctxErr.message || '').toLowerCase();
					const isCtx = errMsg.includes('context') || errMsg.includes('token') || errMsg.includes('maximum');
					if (!isCtx) throw ctxErr;
				}

				if (contextOverflow && memoryEnabled && actionHistory.length > 2) {
					addMessage('system', 'please wait Dreaming...');
					const compressed = await summarizeSession({
						originalTask: taskForAgent,
						actionHistory,
						modelConfig: modelCfg,
						requestTimeoutMs: runtimeRequestTimeoutMs,
					});
					actionHistory.length = 0;
					compressed.forEach((line) => actionHistory.push(line));
					addMessage('system', 'Memory compressed. Continuing task...');
					continue;
				}
				if (contextOverflow) {
					addMessage('system', 'Context window exceeded. Enable Memory in settings to auto-compress.');
					break;
				}

				if (!activeRef.current) break;

				const parsedDecisions = parseAgentDecisions(fullText);

				if (parsedDecisions.length === 0) {
					invalidResponseCount += 1;
					addMessage('system', `Raw response:\n${fullText}`);
					if (invalidResponseCount >= runtimeMaxConsecutiveFailures) {
						const resumed = await waitForManualFix(
							`Model output could not be parsed ${invalidResponseCount} times in a row.`,
							[
								'If the page changed significantly, refresh the page.',
								'If needed, simplify or clarify your task instruction.',
								'You can also switch to another model in settings.',
							]
						);
						if (!resumed) break;
						invalidResponseCount = 0;
						stepCount++;
						continue;
					}
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

				const allowedActions = [
					'CLICK',
					'CLICK_INDEX',
					'CLICK_ID',
					'CLICK_COORDS',
					'DOUBLE_CLICK',
					'TYPE',
					'TYPE_ID',
					'TYPE_COORDS',
					'CLEAR',
					'FOCUS',
					'NAVIGATE',
					'SCROLL',
					'WAIT',
					'HOVER',
					'HOVER_ID',
					'HOVER_COORDS',
					'DRAG',
					'DRAG_ID',
					'DRAG_COORDS',
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
				const normalizedBatch = parsedDecisions.map((d) =>
					normalizeDecision(d)
				);
				const validBatch: typeof normalizedBatch = [];
				const invalidReasons: string[] = [];
				for (const normalized of normalizedBatch) {
					if (!allowedActions.includes(normalized.action)) {
						invalidReasons.push(`Unsupported action: ${normalized.action}`);
						continue;
					}
					const actionValidationError = validateActionPayload(normalized);
					if (actionValidationError) {
						invalidReasons.push(
							`${normalized.action}: ${actionValidationError}`
						);
						continue;
					}
					validBatch.push(normalized);
				}

				if (validBatch.length === 0) {
					invalidResponseCount += 1;
					addMessage(
						'system',
						`Invalid action payload(s): ${invalidReasons.join(' | ')}`
					);
					if (invalidResponseCount >= runtimeMaxConsecutiveFailures) {
						const resumed = await waitForManualFix(
							`Model returned invalid action payload ${invalidResponseCount} times.`,
							[
								'Inspect the latest model response in chat.',
								'Refresh the page if the UI changed.',
								'Then click Continue to retry from current page state.',
							]
						);
						if (!resumed) break;
						invalidResponseCount = 0;
						stepCount++;
						continue;
					}
					const retryDelay = Math.min(
						runtimeInvalidRetryMaxMs,
						runtimeInvalidRetryBaseMs +
							invalidResponseCount * runtimeInvalidRetryIncrementMs
					);
					await new Promise((r) => setTimeout(r, retryDelay));
					continue;
				}
				invalidResponseCount = 0;

				if (invalidReasons.length > 0) {
					addMessage(
						'system',
						`Skipped invalid proposed action(s): ${invalidReasons.join(' | ')}`
					);
				}

				const executableBatch = validBatch.slice(0, runtimeMaxBatchActions);
				if (validBatch.length > executableBatch.length) {
					addMessage(
						'system',
						`Model proposed ${validBatch.length} actions. Executing first ${executableBatch.length} for safety, then re-planning.`
					);
				} else if (executableBatch.length > 1) {
					addMessage(
						'system',
						`Model proposed ${executableBatch.length} actions. Executing sequentially with ${runtimeStepDelayMs}ms delay between steps.`
					);
				}

				for (let batchIndex = 0; batchIndex < executableBatch.length; batchIndex += 1) {
					if (!activeRef.current || stepCount >= runtimeMaxSteps) break;
					const normalized = executableBatch[batchIndex];

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
						const resumed = await waitForManualFix(
							'Agent seems stuck on the same page state and repeated the same action pattern.',
							[
								'Manually do the blocked step (captcha, popup, consent, or login).',
								'If needed, navigate to the next expected page yourself.',
								'Then click Continue so the agent resumes from here.',
							]
						);
						if (!resumed) break;
						recentActions.length = 0;
						pageHistory.length = 0;
						failureCount = 0;
						invalidResponseCount = 0;
						stepCount++;
						continue;
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

					if (normalized.action === 'WAIT_FOR_USER_ACTION') {
						const waitReason =
							typeof normalized.params.reason === 'string' &&
							normalized.params.reason.trim().length > 0
								? normalized.params.reason.trim()
								: 'Complete the needed manual step on the page.';
						const resumed = await waitForManualFix(waitReason);
						if (!resumed) break;
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
						const serverId = String(normalized.params.serverId || '');
						if (!allowedMcpServerIds.has(serverId)) {
							actionResult =
								'MCP_CALL refused: server not enabled in settings.';
						} else {
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
									serverId,
									String(normalized.params.tool || ''),
									enrichment.args
								);
							}
						}
					} else {
						const targetTabId = await tabSession.getTargetTabId();
						if (!targetTabId) throw new Error('No target tab for action');
						const result: any = await executeTabActionInFrames(
							targetTabId,
							normalized,
							assets,
							state?.elements || []
						);
						actionResult = result?.result || 'No result';
						const isClickLikeAction =
							normalized.action === 'CLICK' ||
							normalized.action === 'CLICK_ID' ||
							normalized.action === 'CLICK_INDEX';
						const clickFailed =
							typeof actionResult === 'string' &&
							/(Failed|Error)/i.test(actionResult);
						if (isClickLikeAction && clickFailed) {
							const fallbackUrl = resolveClickFallbackUrl(
								state?.elements || [],
								normalized as { action: string; params: Record<string, unknown> }
							);
							if (fallbackUrl) {
								const tabOpenResult = await tabSession.openTab(fallbackUrl, false);
								if (!/(Failed|Error|Refused)/i.test(tabOpenResult)) {
									actionResult = `Opened link URL in a new tab via click fallback: ${fallbackUrl}`;
								}
							}
						}
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
						const resumed = await waitForManualFix(
							`Too many action failures (${runtimeMaxConsecutiveFailures}) in a row.`,
							[
								'Inspect page for blockers (modals, popups, captcha, auth prompts).',
								'Manually complete the blocker and keep the target page open.',
								'Click Continue to resume from current state.',
							]
						);
						if (!resumed) break;
						failureCount = 0;
						invalidResponseCount = 0;
						recentActions.length = 0;
						stepCount++;
						continue;
					}

					const isNavAction =
						normalized.action === 'NAVIGATE' ||
						normalized.action === 'OPEN_TAB';
					const navDelay = isNavAction
						? Math.max(2500, runtimeStepDelayMs)
						: runtimeStepDelayMs;
					stepCount++;
					await new Promise((r) => setTimeout(r, navDelay));
				}
			}
		} catch (e: any) {
			addMessage('system', `Error: ${e.message}`);
		} finally {
			releasePendingContinue();
			if (shouldRestoreMainTab) {
				try {
					await tabSession.ensureCurrentTabActive();
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
		const baseTaskForAgentRaw = currentTask;
		const userContextBlock = buildSelectedUserContextBlock();
		const baseTaskForAgent = `${baseTaskForAgentRaw}${userContextBlock}`;
		const { requestedAssets, missing: missingAssets } = resolveRequestedAssetRefs(
			baseTaskForAgent,
			assets
		);
		const { requestedSkills, missing } = await loadRequestedSkills(baseTaskForAgent);
		const requestedSkillsBlock =
			requestedSkills.length > 0
				? `\n\nREQUESTED SKILLS (load only these):\n${requestedSkills
						.map((skill) => `Skill: ${skill.name}\n${skill.content}`)
						.join('\n\n')}`
				: '';
		const requestedAssetsBlock =
			requestedAssets.length > 0
				? `\n\nREQUESTED ASSETS (focus these names):\n${requestedAssets
						.map(
							(asset) =>
								`${asset.name} (${asset.type}, ${asset.size} bytes, ${asset.source || 'uploaded'})`
						)
						.join('\n')}`
				: '';
		const taskForAgent = `${baseTaskForAgent}${requestedSkillsBlock}${requestedAssetsBlock}`;
		addMessage('user', currentTask);
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
		if (requestedAssets.length > 0) {
			addMessage(
				'system',
				`Assets in scope: ${requestedAssets.map((asset) => asset.name).join(', ')}`
			);
		}
		if (missingAssets.length > 0) {
			addMessage(
				'system',
				`Requested asset(s) not found: ${missingAssets.join(', ')}. Use @asset:AssetName with an existing asset name.`
			);
		}
		setTask('');
		const runtimeRequestTimeoutMs = Math.max(1000, Math.floor(requestTimeoutMs));

		const modelCfg = activeModelConfig;
		if (!modelCfg) {
			addMessage('system', 'No model configured. Add a model in settings first.');
			setIsRunning(false);
			return;
		}
		const supportsVision = modelCfg.supportsVision;
		let brain: Awaited<ReturnType<typeof createStreamingBrain>>;
		try {
			brain = await createStreamingBrain(modelCfg, {
				requestTimeoutMs: runtimeRequestTimeoutMs,
			});
		} catch (e: any) {
			addMessage('system', `Could not load model: ${formatModelLoadError(e)}`);
			setIsRunning(false);
			return;
		}
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
			const { tab, openedNewTab } = await resolveAgentTab();
			if (!tab?.id) throw new Error('No active tab');
			if (openedNewTab) {
				addMessage('system', 'Opened a new browser tab to answer your question.');
			}

			let state: any = null;
			try {
				state = await getTabStateFromFrames(tab.id);
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
		memoryEnabled,
		setMemoryEnabled,
		isMemorySettingsOpen,
		setIsMemorySettingsOpen,
		modelConfigs,
		setModelConfigs,
		activeModelId,
		setActiveModelId,
		activeModelConfig,
		showModelForm,
		setShowModelForm,
		editingModelId,
		setEditingModelId,
		modelFormName,
		setModelFormName,
		modelFormBaseUrl,
		setModelFormBaseUrl,
		modelFormApiKey,
		setModelFormApiKey,
		modelFormModelName,
		setModelFormModelName,
		modelFormSupportsVision,
		setModelFormSupportsVision,
		modelFormUseManual,
		setModelFormUseManual,
		modelFormAvailableModels,
		showDiscardDialog,
		setShowDiscardDialog,
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
		modelTestingById,
		modelTestResultById,
		modelFormTab,
		setModelFormTab,
		modelFormWebGpuBackend,
		setModelFormWebGpuBackend,
		modelFormWebGpuSource,
		setModelFormWebGpuSource,
		modelFormWebGpuHfOnnx,
		setModelFormWebGpuHfOnnx,
		modelFormWebGpuHfGgufRepo,
		setModelFormWebGpuHfGgufRepo,
		modelFormWebGpuHfGgufFile,
		setModelFormWebGpuHfGgufFile,
		modelFormWebGpuGgufUrl,
		setModelFormWebGpuGgufUrl,
		modelFormGgufConfigError,
		setModelFormGgufConfigError,
		modelFormWebGpuUpload,
		setModelFormWebGpuUpload,
		modelFormWebGpuContextWindowTokens,
		setModelFormWebGpuContextWindowTokens,
		webGpuSaving,
		templates,
		setTemplates,
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
		showTemplatePicker,
		setShowTemplatePicker,
		showMcpPicker,
		setShowMcpPicker,
		showSkillsPicker,
		setShowSkillsPicker,
		showAssetsPicker,
		setShowAssetsPicker,
		showHistoryPanel,
		setShowHistoryPanel,
		isModelsSettingsOpen,
		setIsModelsSettingsOpen,
		isRuntimeControlsOpen,
		setIsRuntimeControlsOpen,
		isPromptTemplatesSettingsOpen,
		setIsPromptTemplatesSettingsOpen,
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
		isSettingsTransferOpen,
		setIsSettingsTransferOpen,
		settingsTransferSelection,
		setSettingsTransferSelection,
		settingsTransferJson,
		setSettingsTransferJson,
		settingsTransferStatus,
		setSettingsTransferStatus,
		uiZoom,
		setUiZoom,
		isDark,
		setIsDark,
		showTemplateForm,
		setShowTemplateForm,
		openModelMenuId,
		setOpenModelMenuId,
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
		autoScrollEnabled,
		setAutoScrollEnabled,
		waitingForUserAction,
		setWaitingForUserAction,
		saveSettings,
		fetchModelsForForm,
		saveModelConfig,
		startEditModelConfig,
		clearModelForm,
		deleteModelConfigById,
		testModelConfigById,
		attemptLeaveSettings,
		confirmDiscardSettings,
		hasUnsavedRuntimeChanges,
		toggleSettingsTransferCategory,
		exportSettingsJson,
		loadSettingsTransferFile,
		importSettingsJson,
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
		appendTemplateToTask,
		appendMcpRefToTask,
		appendSkillRefToTask,
		appendAssetRefToTask,
		zoomOut,
		zoomIn,
		bottomRef,
		messagesContainerRef,
		activeRef,
		inputRef,
		continueResolverRef,
		handleMessagesScroll,
		toggleAutoScroll,
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
	};
};

export type AgentAppModel = ReturnType<typeof useAgentApp>;

export default useAgentApp;
