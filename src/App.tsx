import { useState, useEffect, useRef } from 'react'
import { AgentBrain } from './agent/brain'

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
  const [task, setTask] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Settings State
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('agent_base_url') || 'http://localhost:11434/v1')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('agent_api_key') || '')
  const [modelName, setModelName] = useState(() => localStorage.getItem('agent_model') || 'gpt-3.5-turbo')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [useManualTextModel, setUseManualTextModel] = useState(false)
  const [visionBaseUrl, setVisionBaseUrl] = useState(() => localStorage.getItem('agent_vision_base_url') || 'http://localhost:11434/v1')
  const [visionApiKey, setVisionApiKey] = useState(() => localStorage.getItem('agent_vision_api_key') || '')
  const [visionModelName, setVisionModelName] = useState(() => localStorage.getItem('agent_vision_model') || 'llava')
  const [visionAvailableModels, setVisionAvailableModels] = useState<string[]>([])
  const [useManualVisionModel, setUseManualVisionModel] = useState(false)
  const [templates, setTemplates] = useState<PromptTemplate[]>(() => {
    try {
      const raw = localStorage.getItem('agent_prompt_templates')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [activeTemplateId, setActiveTemplateId] = useState(() => localStorage.getItem('agent_active_template') || '')
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateContent, setTemplateContent] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [assets, setAssets] = useState<AssetFile[]>([])
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [showTemplatePanel, setShowTemplatePanel] = useState(false)
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)
  const [isDark, setIsDark] = useState(true)
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [openTemplateMenuId, setOpenTemplateMenuId] = useState<string | null>(null)
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false)
  const [assetQuery, setAssetQuery] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setIsDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('agent_session_messages')
      if (raw) {
        setMessages(JSON.parse(raw))
      } else {
        setMessages([{ role: 'system', content: 'Standalone Agent Ready. Configure settings first.' }])
      }
    } catch {
      setMessages([{ role: 'system', content: 'Standalone Agent Ready. Configure settings first.' }])
    } finally {
      setSessionLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!sessionLoaded) return
    const snapshot = messages.slice(-200)
    localStorage.setItem('agent_session_messages', JSON.stringify(snapshot))
  }, [messages, sessionLoaded])

  useEffect(() => {
    localStorage.setItem('agent_prompt_templates', JSON.stringify(templates))
  }, [templates])

  useEffect(() => {
    localStorage.setItem('agent_active_template', activeTemplateId)
  }, [activeTemplateId])

  // Save settings
  const saveSettings = () => {
    localStorage.setItem('agent_base_url', baseUrl)
    localStorage.setItem('agent_api_key', apiKey)
    localStorage.setItem('agent_model', modelName)
    localStorage.setItem('agent_vision_base_url', visionBaseUrl)
    localStorage.setItem('agent_vision_api_key', visionApiKey)
    localStorage.setItem('agent_vision_model', visionModelName)
    setShowSettings(false)
    addMessage('system', `Settings Saved. Model: ${modelName}`)
  }

  const fetchModels = async () => {
    addMessage('system', "Fetching models...")
    const models = await AgentBrain.fetchModels(baseUrl, apiKey);
    if (models.length > 0) {
      setAvailableModels(models);
      addMessage('system', `Found ${models.length} models.`);
    } else {
      addMessage('system', "No models found or connection failed.");
    }
  }

  const fetchVisionModels = async () => {
    addMessage('system', "Fetching vision models...")
    const models = await AgentBrain.fetchModels(visionBaseUrl, visionApiKey);
    if (models.length > 0) {
      setVisionAvailableModels(models);
      addMessage('system', `Found ${models.length} vision models.`);
    } else {
      addMessage('system', "No vision models found or connection failed.");
    }
  }

  const clearSession = () => {
    setMessages([{ role: 'system', content: 'Standalone Agent Ready. Configure settings first.' }])
    localStorage.removeItem('agent_session_messages')
  }

  const saveTemplate = () => {
    const name = templateName.trim()
    const content = templateContent.trim()
    if (!name || !content) return
    if (editingTemplateId) {
      setTemplates(prev => prev.map(t => t.id === editingTemplateId ? { ...t, name, content } : t))
    } else {
      const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2)}`
      setTemplates(prev => [...prev, { id, name, content }])
      setActiveTemplateId(id)
    }
    setEditingTemplateId(null)
    setTemplateName('')
    setTemplateContent('')
    setShowTemplateForm(false)
  }

  const startEditTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id)
    if (!tpl) return
    setEditingTemplateId(tpl.id)
    setTemplateName(tpl.name)
    setTemplateContent(tpl.content)
    setShowTemplateForm(true)
  }

  const clearTemplateEditor = () => {
    setEditingTemplateId(null)
    setTemplateName('')
    setTemplateContent('')
    setShowTemplateForm(false)
  }

  const deleteTemplateById = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    if (activeTemplateId === id) setActiveTemplateId('')
    if (editingTemplateId === id) clearTemplateEditor()
    setOpenTemplateMenuId(null)
  }

  const readFileAsText = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })

  const addAssets = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const maxBytes = 8_000_000
    const newItems: AssetFile[] = []

    for (const file of Array.from(fileList)) {
      if (file.size > maxBytes) {
        addMessage('system', `Skipped ${file.name} (asset too large).`)
        continue
      }
      const dataUrl = await readFileAsDataUrl(file)
      newItems.push({
        id: `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl
      })
    }

    if (newItems.length > 0) {
      setAssets(prev => [...prev, ...newItems])
    }
  }

  const removeAsset = (id: string) => {
    setAssets(prev => prev.filter(f => f.id !== id))
  }

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const maxTextBytes = 200_000
    const maxImageBytes = 4_000_000
    const newItems: AttachedFile[] = []

    for (const file of Array.from(fileList)) {
      if (file.type.startsWith('image/')) {
        if (file.size > maxImageBytes) {
          addMessage('system', `Skipped ${file.name} (image too large).`)
          continue
        }
        const dataUrl = await readFileAsDataUrl(file)
        newItems.push({
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl
        })
      } else {
        if (file.size > maxTextBytes) {
          addMessage('system', `Skipped ${file.name} (file too large).`)
          continue
        }
        const textContent = await readFileAsText(file)
        newItems.push({
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          textContent
        })
      }
    }

    if (newItems.length > 0) {
      setAttachedFiles(prev => [...prev, ...newItems])
    }
  }

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id))
  }

  const startNewChat = () => {
    clearSession()
    setTask('')
    setAttachedFiles([])
  }

  const buildFileContext = async (brain: AgentBrain, taskForAgent: string) => {
    if (attachedFiles.length === 0) return ''
    const summaries = await Promise.all(attachedFiles.map(async file => {
      if (file.dataUrl) {
        const visionSummary = await brain.describeImage(taskForAgent, file.dataUrl, file.name)
        if (visionSummary) {
          return `Image: ${file.name}\n${visionSummary}`
        }
        return `Image: ${file.name} (vision unavailable)`
      }
      const text = (file.textContent || '').slice(0, 4000)
      return `File: ${file.name}\n${text}`
    }))
    return summaries.join('\n\n')
  }

  const buildAssetCatalog = () => {
    if (assets.length === 0) return ''
    return assets.map(a => `${a.name} (${a.type}, ${a.size} bytes)`).join('\n')
  }

  const hashString = (input: string) => {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i)
      hash |= 0
    }
    return hash.toString()
  }

  const tryParseJson = (raw: string) => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const repairJson = (raw: string) => {
    let cleaned = raw.trim()
    cleaned = cleaned.replace(/```json|```/gi, '')
    cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    cleaned = cleaned.replace(/\/\/.*$/gm, '')
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
    cleaned = cleaned.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, s) => `"${String(s).replace(/"/g, '\\"')}"`)
    cleaned = cleaned.replace(/([,{]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
    return cleaned
  }

  const parseAgentDecision = (raw: string) => {
    const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/i)
    const candidates = []
    if (fenceMatch?.[1]) candidates.push(fenceMatch[1])
    const braceMatch = raw.match(/\{[\s\S]*\}/)
    if (braceMatch?.[0]) candidates.push(braceMatch[0])
    candidates.push(raw)

    for (const candidate of candidates) {
      const direct = tryParseJson(candidate)
      if (direct?.action) return direct
      const repaired = tryParseJson(repairJson(candidate))
      if (repaired?.action) return repaired
    }
    return null
  }

  const normalizeDecision = (decision: any) => {
    if (!decision || !decision.action) return decision
    const params = decision.params || {}
    if (decision.action === 'CLICK' && params.id) return { ...decision, action: 'CLICK_ID' }
    if (decision.action === 'CLICK' && typeof params.x === 'number' && typeof params.y === 'number') {
      return { ...decision, action: 'CLICK_COORDS' }
    }
    if (decision.action === 'TYPE' && params.id) return { ...decision, action: 'TYPE_ID' }
    if (decision.action === 'TYPE' && typeof params.x === 'number' && typeof params.y === 'number') {
      return { ...decision, action: 'TYPE_COORDS' }
    }
    if (decision.action === 'HOVER' && params.id) return { ...decision, action: 'HOVER_ID' }
    if (decision.action === 'HOVER' && typeof params.x === 'number' && typeof params.y === 'number') {
      return { ...decision, action: 'HOVER_COORDS' }
    }
    if (decision.action === 'SELECT' && params.id) return { ...decision, action: 'SELECT_ID' }
    return decision
  }

  const buildElementMapSummary = (elements: any[]) => {
    if (!Array.isArray(elements)) return ''
    const limited = elements.slice(0, 250)
    const json = JSON.stringify(limited)
    return json.length > 20000 ? json.slice(0, 20000) : json
  }

  const captureVisibleTab = async () => {
    const tab = await getCurrentTab()
    if (!tab?.windowId) return null
    try {
      return await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
    } catch (e) {
      return null
    }
  }

  const runAgent = async (currentTask: string) => {
    if (!currentTask.trim()) return;
    setIsRunning(true)
    const activeTemplate = templates.find(t => t.id === activeTemplateId)
    const taskForAgent = activeTemplate ? `${activeTemplate.content}\n\nUser Task:\n${currentTask}` : currentTask
    addMessage('user', currentTask)
    if (activeTemplate) {
      addMessage('system', `Template: ${activeTemplate.name}`)
    }
    setTask('')

    // Initial Brain
    const brain = new AgentBrain(apiKey, baseUrl, modelName, visionApiKey, visionBaseUrl, visionModelName);
    const fileContext = await buildFileContext(brain, taskForAgent)
    const assetCatalog = buildAssetCatalog()

    let stepCount = 0;
    const actionHistory: string[] = [];
    const pageHistory: string[] = [];
    const recentActions: string[] = [];
    let failureCount = 0;
    let invalidResponseCount = 0;
    activeRef.current = true;
    (window as any).stopAgent = () => { activeRef.current = false; setIsRunning(false); };

    try {
      while (activeRef.current && stepCount < 30) {
        const tab = await getCurrentTab();
        if (!tab?.id) throw new Error("No active tab");

        let state: any = null;
        try {
          state = await chrome.tabs.sendMessage(tab.id, { type: "GET_CONTENT" });
        } catch (e) {
          throw new Error("Could not connect to page. Try refreshing the page.");
        }

        if (!state) throw new Error("Could not read page content.");

        if (!activeRef.current) break;

        const pageHash = hashString(state.content || "")
        pageHistory.push(pageHash)
        if (pageHistory.length > 6) pageHistory.shift()

        // --- Call Local Brain ---
        const screenshot = await captureVisibleTab()
        const visionObservation = await brain.observeWithVision(taskForAgent, state.url, screenshot || undefined, state.viewport)
        if (visionObservation) {
          addMessage('system', `Vision:\n${visionObservation.slice(0, 2000)}`)
        }
        const elementMap = buildElementMapSummary(state.elements || [])
        const stream = brain.processStep(taskForAgent, state.url, state.content, actionHistory, visionObservation, fileContext, elementMap, assetCatalog);

        let fullText = "";
        addMessage('agent', '');

        for await (const chunk of stream) {
          if (!activeRef.current) break;
          fullText += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.role === 'agent') {
              return [...prev.slice(0, -1), { ...last, content: fullText }];
            }
            return prev;
          });
        }

        if (!activeRef.current) break;

        // Parsing Logic (tolerant of local model JSON quirks)
        const decision = parseAgentDecision(fullText)

        if (!decision || !decision.action) {
          invalidResponseCount += 1
          addMessage('system', `Raw response:\n${fullText}`)
          const retryDelay = Math.min(5000, 500 + invalidResponseCount * 500)
          addMessage('system', `Invalid response. Retrying in ${retryDelay}ms...`)
          await new Promise(r => setTimeout(r, retryDelay))
          continue
        }
        invalidResponseCount = 0
        const normalized = normalizeDecision(decision)

        const allowedActions = ['CLICK', 'CLICK_INDEX', 'CLICK_ID', 'CLICK_COORDS', 'TYPE', 'TYPE_ID', 'TYPE_COORDS', 'NAVIGATE', 'SCROLL', 'WAIT', 'HOVER', 'HOVER_ID', 'HOVER_COORDS', 'SELECT', 'SELECT_ID', 'UPLOAD_ASSET', 'KEY', 'DONE', 'ASK']
        if (!allowedActions.includes(normalized.action)) {
          throw new Error(`Unsupported action: ${normalized.action}`)
        }

        const actionKey = `${normalized.action}:${JSON.stringify(normalized.params || {})}`
        recentActions.push(actionKey)
        if (recentActions.length > 4) recentActions.shift()
        const isRepeating = recentActions.length === 4 && recentActions.every(a => a === actionKey)
        const isStuck = pageHistory.length >= 3 && pageHistory.slice(-3).every(h => h === pageHash)
        if (isRepeating && isStuck) {
          activeRef.current = false
          addMessage('system', "Agent seems stuck. Please guide the next step.")
          break
        }

        actionHistory.push(`Action: ${normalized.action} Params: ${JSON.stringify(normalized.params)}`);

        if (normalized.action === 'DONE') {
          activeRef.current = false;
          addMessage('system', "Task Completed.");
          break;
        }

        if (normalized.action === 'ASK') {
          activeRef.current = false;
          addMessage('system', `Question: ${normalized.params.question}`);
          break;
        }

        const result: any = await chrome.tabs.sendMessage(tab.id, {
          type: "EXECUTE_ACTION",
          action: normalized,
          assets
        });

        addMessage('system', `Result: ${result.result}`);
        actionHistory.push(`Result: ${result.result}`);
        if (typeof result.result === 'string' && /(Failed|Error)/i.test(result.result)) {
          failureCount += 1
        } else {
          failureCount = 0
        }
        if (failureCount >= 3) {
          activeRef.current = false
          addMessage('system', "Too many failures. Please adjust the task or provide guidance.")
          break
        }

        stepCount++;
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e: any) {
      addMessage('system', `Error: ${e.message}`);
    } finally {
      setIsRunning(false)
    }
  }

  const getCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  const addMessage = (role: 'user' | 'agent' | 'system', content: string) => {
    setMessages(prev => [...prev, { role, content }])
  }

  const computeAssetSuggestions = (value: string, caret: number | null) => {
    if (!caret) return { active: false, query: '' }
    const upto = value.slice(0, caret)
    const atIndex = upto.lastIndexOf('@')
    if (atIndex === -1) return { active: false, query: '' }
    const query = upto.slice(atIndex + 1)
    if (query.includes(' ')) return { active: false, query: '' }
    return { active: true, query }
  }

  const applyAssetMention = (name: string) => {
    const input = inputRef.current
    if (!input) return
    const caret = input.selectionStart ?? input.value.length
    const upto = input.value.slice(0, caret)
    const atIndex = upto.lastIndexOf('@')
    if (atIndex === -1) return
    const before = input.value.slice(0, atIndex)
    const after = input.value.slice(caret)
    const next = `${before}@asset:${name} ${after}`
    setTask(next)
    setShowAssetSuggestions(false)
    setAssetQuery('')
    requestAnimationFrame(() => {
      input.focus()
      const pos = (before + `@asset:${name} `).length
      input.setSelectionRange(pos, pos)
    })
  }

  const activeTemplateDisplay = templates.find(t => t.id === activeTemplateId)
  const inputClass = isDark
    ? 'w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm'
    : 'w-full bg-white border border-slate-200 rounded p-2 text-sm'
  const panelClass = isDark
    ? 'bg-slate-800/40 border border-slate-700'
    : 'bg-white border border-slate-200'
  const labelClass = isDark ? 'text-gray-400' : 'text-gray-600'
  const subtleClass = isDark ? 'text-gray-400' : 'text-gray-600'
  const secondaryButtonClass = isDark
    ? 'bg-slate-700 hover:bg-slate-600 text-white'
    : 'bg-slate-200 hover:bg-slate-300 text-slate-900'

  const parseAgentMessage = (content: string) => {
    const thoughtMatch = content.match(/Thought:\s*([\s\S]*?)(?=\n```json|\n```|\n$)/i)
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i)
    let actionSummary = ''
    let actionType = ''
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        actionType = parsed?.action || ''
        if (parsed?.params?.summary) actionSummary = parsed.params.summary
      } catch {
        actionSummary = ''
      }
    }
    return {
      thought: thoughtMatch ? thoughtMatch[1].trim() : '',
      actionType,
      actionSummary
    }
  }

  if (showSettings) {
    return (
      <div
        className={`w-full h-screen p-4 font-sans overflow-y-auto ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}
        style={{ colorScheme: isDark ? 'dark' : 'light' }}
      >
        <h2 className="text-lg font-bold mb-4">Agent Settings</h2>
          <div className="space-y-6">
          <div className={`${panelClass} rounded-lg p-4`}>
            <div className="text-xs font-semibold text-blue-300 mb-3 uppercase tracking-wide">Text LLM (Action Agent)</div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>Base URL (e.g., http://localhost:11434/v1)</label>
                <input
                  className={inputClass}
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>API Key</label>
                <input
                  type="password"
                  className={inputClass}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block text-sm ${labelClass}`}>Model Name</label>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-1 text-xs ${subtleClass}`}>
                      <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={useManualTextModel}
                        onChange={e => setUseManualTextModel(e.target.checked)}
                      />
                      Manual
                    </label>
                    <button onClick={fetchModels} className="text-xs text-blue-400 hover:text-blue-300">
                      ↻ Fetch Models
                    </button>
                  </div>
                </div>
                {!useManualTextModel && availableModels.length > 0 ? (
                  <select
                    className={inputClass}
                    value={modelName}
                    onChange={e => setModelName(e.target.value)}
                  >
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={modelName}
                    onChange={e => setModelName(e.target.value)}
                    placeholder="e.g. gpt-4o"
                  />
                )}
              </div>
            </div>
          </div>

          <div className={`${panelClass} rounded-lg p-4`}>
            <div className="text-xs font-semibold text-purple-300 mb-3 uppercase tracking-wide">Vision LLM (Observer)</div>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>Base URL (vision endpoint)</label>
                <input
                  className={inputClass}
                  value={visionBaseUrl}
                  onChange={e => setVisionBaseUrl(e.target.value)}
                />
              </div>
              <div>
                <label className={`block text-sm mb-1 ${labelClass}`}>API Key</label>
                <input
                  type="password"
                  className={inputClass}
                  value={visionApiKey}
                  onChange={e => setVisionApiKey(e.target.value)}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block text-sm ${labelClass}`}>Vision Model Name</label>
                  <div className="flex items-center gap-3">
                    <label className={`flex items-center gap-1 text-xs ${subtleClass}`}>
                      <input
                        type="checkbox"
                        className="accent-purple-500"
                        checked={useManualVisionModel}
                        onChange={e => setUseManualVisionModel(e.target.checked)}
                      />
                      Manual
                    </label>
                    <button onClick={fetchVisionModels} className="text-xs text-purple-400 hover:text-purple-300">
                      ↻ Fetch Models
                    </button>
                  </div>
                </div>
                {!useManualVisionModel && visionAvailableModels.length > 0 ? (
                  <select
                    className={inputClass}
                    value={visionModelName}
                    onChange={e => setVisionModelName(e.target.value)}
                  >
                    {visionAvailableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={visionModelName}
                    onChange={e => setVisionModelName(e.target.value)}
                    placeholder="e.g. llava, qwen2-vl"
                  />
                )}
              </div>
            </div>
          </div>

          <div className={`${panelClass} rounded-lg p-4`}>
            <div className="text-xs font-semibold text-amber-300 mb-3 uppercase tracking-wide">Assets (Upload Only)</div>
            <div className="space-y-3">
              <label className={`cursor-pointer text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                ＋ Add Assets
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={e => addAssets(e.target.files)}
                />
              </label>
              {assets.length === 0 ? (
                <div className={`text-xs ${subtleClass}`}>No assets yet.</div>
              ) : (
                <div className="space-y-2">
                  {assets.map(asset => (
                    <div key={asset.id} className={`flex items-center justify-between rounded px-2 py-2 text-xs ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
                      <div className="truncate">{asset.name}</div>
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className={`text-xs ${subtleClass}`}>Use @ to reference assets by name in tasks.</div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={saveSettings}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 text-sm flex-1"
            >Save & Close</button>
            <button
              onClick={() => setShowSettings(false)}
              className={`${secondaryButtonClass} rounded px-4 py-2 text-sm`}
            >Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-full h-screen flex flex-col font-sans ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}
      style={{ colorScheme: isDark ? 'dark' : 'light' }}
    >
      <div className={`p-4 border-b ${isDark ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-white'} backdrop-blur flex justify-between items-center`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : isDark ? 'bg-gray-500' : 'bg-gray-400'}`}></div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            General Agent
          </h1>
        </div>
        <div className="flex gap-2">
          {isRunning && (
            <button
              onClick={() => (window as any).stopAgent && (window as any).stopAgent()}
              className="text-red-500 hover:text-red-600 text-xs border border-red-500/50 rounded px-2 py-1 transition-colors"
            >
              STOP
            </button>
          )}
          <button
            onClick={() => setShowTemplatePanel(v => !v)}
            className={`text-xs border rounded px-2 py-1 ${showTemplatePanel ? 'text-emerald-400 border-emerald-400/60' : isDark ? 'text-gray-400 border-white/10 hover:text-white' : 'text-gray-600 border-slate-200 hover:text-gray-900'}`}
            title="Templates"
          >
            ⌘
          </button>
          <button
            onClick={() => setShowHistoryPanel(v => !v)}
            className={`text-xs border rounded px-2 py-1 ${showHistoryPanel ? 'text-gray-200 border-gray-300/60' : isDark ? 'text-gray-400 border-white/10 hover:text-white' : 'text-gray-600 border-slate-200 hover:text-gray-900'}`}
            title="History"
          >
            ⏱
          </button>
          <button
            onClick={startNewChat}
            className={`text-xs border rounded px-2 py-1 ${isDark ? 'text-blue-400 border-blue-400/50 hover:text-blue-300' : 'text-blue-600 border-blue-500/50 hover:text-blue-700'}`}
            title="New chat"
          >
            ＋
          </button>
          <button onClick={() => setShowSettings(true)} className="text-gray-400 hover:text-white" title="Settings">
            ⚙
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-lg p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? (isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white') :
                  m.role === 'agent' ? (isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200') : (isDark ? 'text-gray-400 text-xs bg-slate-900/50' : 'text-gray-600 text-xs bg-slate-200/60')
                  }`}>
                  {m.role === 'agent' ? (() => {
                    const parsed = parseAgentMessage(m.content)
                    const hasContent = m.content.trim().length > 0
                    const hasParsed = parsed.thought || parsed.actionSummary || parsed.actionType
                    return (
                      <div className="space-y-2">
                        {!hasContent ? (
                          <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Thinking…</div>
                        ) : hasParsed ? (
                          <div className="space-y-2">
                            {parsed.thought && (
                              <div>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Thought</div>
                                <div className="text-sm">{parsed.thought}</div>
                              </div>
                            )}
                            {(parsed.actionType || parsed.actionSummary) && (
                              <div>
                                <div className={`text-xs mb-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Action</div>
                                <div className="text-sm">
                                  {parsed.actionType ? `Type: ${parsed.actionType}` : 'Type: —'}
                                </div>
                                {parsed.actionSummary && (
                                  <div className="text-sm mt-1">{parsed.actionSummary}</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>{m.content}</div>
                        )}
                        {hasContent && (
                          <button
                            onClick={() => navigator.clipboard.writeText(m.content)}
                            className={`text-xs ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                            title="Copy raw response"
                          >
                            ⧉
                          </button>
                        )}
                      </div>
                    )
                  })() : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className={`p-4 border-t ${isDark ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`flex items-center justify-between text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <div>
                Template: {activeTemplateDisplay ? activeTemplateDisplay.name : 'None'}
              </div>
              <label className={`cursor-pointer ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}>
                📎
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={e => addFiles(e.target.files)}
                />
              </label>
            </div>
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachedFiles.map(file => (
                  <div key={file.id} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{file.name}</span>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-red-400 hover:text-red-300"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className={`flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
                placeholder={isRunning ? "Agent is active..." : "Enter task..."}
                value={task}
                onChange={e => {
                  const next = e.target.value
                  setTask(next)
                  const caret = e.target.selectionStart
                  const { active, query } = computeAssetSuggestions(next, caret)
                  setShowAssetSuggestions(active)
                  setAssetQuery(query)
                }}
                disabled={isRunning}
                onKeyDown={e => e.key === 'Enter' && !isRunning && runAgent(task)}
              />
              <button
                disabled={isRunning}
                onClick={() => runAgent(task)}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
              >
                {isRunning ? '…' : 'Go'}
              </button>
            </div>
            {showAssetSuggestions && assets.length > 0 && (
              <div className={`mt-2 rounded border text-xs ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
                {assets
                  .filter(a => a.name.toLowerCase().includes(assetQuery.toLowerCase()))
                  .slice(0, 6)
                  .map(asset => (
                    <button
                      key={asset.id}
                      className={`w-full text-left px-3 py-2 ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                      onClick={() => applyAssetMention(asset.name)}
                    >
                      {asset.name}
                    </button>
                  ))}
              </div>
            )}
            <div className={`text-xs text-center mt-2 ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              Model: {modelName}
            </div>
          </div>
        </div>

        {(showTemplatePanel || showHistoryPanel) && (
          <div className={`w-80 border-l ${isDark ? 'border-white/10 bg-slate-900/70' : 'border-slate-200 bg-white'} p-4 space-y-4 overflow-y-auto`}>
            {showTemplatePanel && (
              <div className={`${panelClass} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">Prompt Templates</div>
                  <button
                    onClick={() => {
                      clearTemplateEditor()
                      setShowTemplateForm(true)
                    }}
                    className={`text-xs px-2 py-1 rounded border ${isDark ? 'text-emerald-400 border-emerald-400/60' : 'text-emerald-600 border-emerald-500/60'}`}
                    title="New template"
                  >
                    ＋
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm mb-2 ${labelClass}`}>Saved Templates</label>
                    {templates.length === 0 ? (
                      <div className={`text-xs ${subtleClass}`}>No templates yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {templates.map(t => (
                          <div
                            key={t.id}
                            className={`relative rounded border px-2 py-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}
                          >
                            <button
                              onClick={() => {
                                setActiveTemplateId(t.id)
                                setTask(t.content)
                              }}
                              className="w-full text-left"
                              title="Load into task input"
                            >
                              <div className="truncate">{t.name}</div>
                              <div className={`truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{t.content.slice(0, 80)}{t.content.length > 80 ? '…' : ''}</div>
                            </button>
                            <button
                              onClick={() => setOpenTemplateMenuId(openTemplateMenuId === t.id ? null : t.id)}
                              className={`absolute top-2 right-2 text-xs px-2 py-1 rounded border ${isDark ? 'border-slate-600 text-gray-300 hover:text-white' : 'border-slate-200 text-gray-600 hover:text-gray-900'}`}
                              title="More"
                            >
                              ⋯
                            </button>
                            {openTemplateMenuId === t.id && (
                              <div className={`absolute right-2 top-9 z-10 rounded border p-1 text-xs ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <button
                                  onClick={() => {
                                    setOpenTemplateMenuId(null)
                                    startEditTemplate(t.id)
                                  }}
                                  className={`block w-full text-left px-2 py-1 rounded ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteTemplateById(t.id)}
                                  className={`block w-full text-left px-2 py-1 rounded ${isDark ? 'text-red-400 hover:bg-slate-800' : 'text-red-600 hover:bg-slate-100'}`}
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
                    <label className={`block text-sm mb-1 ${labelClass}`}>Active Template</label>
                    <select
                      className={inputClass}
                      value={activeTemplateId}
                      onChange={e => setActiveTemplateId(e.target.value)}
                    >
                      <option value="">None</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {showTemplateForm && (
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-sm mb-1 ${labelClass}`}>Template Name</label>
                        <input
                          className={inputClass}
                          value={templateName}
                          onChange={e => setTemplateName(e.target.value)}
                          placeholder="e.g. Job Application"
                        />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1 ${labelClass}`}>Template Content</label>
                        <textarea
                          className={`w-full rounded p-2 text-sm h-28 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}
                          value={templateContent}
                          onChange={e => setTemplateContent(e.target.value)}
                          placeholder="Add system-level instructions or constraints..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveTemplate}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded px-4 py-2 text-sm flex-1"
                        >
                          {editingTemplateId ? 'Update Template' : 'Save Template'}
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
                <div className={`text-xs font-semibold mb-3 uppercase tracking-wide ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>Session History</div>
                <div className="flex items-center justify-between">
                  <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Messages: {messages.length}</div>
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
  )
}

export default App

