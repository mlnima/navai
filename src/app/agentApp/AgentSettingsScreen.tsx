import ChevronIcon from '../icons/ChevronIcon';
import MoreVerticalIcon from '../icons/MoreVerticalIcon';
import decodeDataUrlText from '../file/decodeDataUrlText';
import { toMcpServersJsonText } from '../../agent/mcpConfig';
import type { AgentAppModel } from './useAgentApp';

const AgentSettingsScreen = (p: AgentAppModel) => {
	const {
		attemptLeaveSettings,
		saveSettings,
		showDiscardDialog,
		setShowDiscardDialog,
		confirmDiscardSettings,
		modelConfigs,
		activeModelId,
		setActiveModelId,
		isModelsSettingsOpen,
		setIsModelsSettingsOpen,
		showModelForm,
		setShowModelForm,
		editingModelId,
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
		saveModelConfig,
		startEditModelConfig,
		clearModelForm,
		deleteModelConfigById,
		fetchModelsForForm,
		isRuntimeControlsOpen,
		setIsRuntimeControlsOpen,
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
		showAddMcp,
		setShowAddMcp,
		mcpJsonInput,
		setMcpJsonInput,
		mcpInputError,
		setMcpInputError,
		mcpTestingById,
		mcpTestResultById,
		isMcpSettingsOpen,
		setIsMcpSettingsOpen,
		openMcpMenuId,
		setOpenMcpMenuId,
		addMcpServerFromJson,
		toggleMcpServer,
		confirmAndRemoveMcpServer,
		startEditMcpServer,
		testMcpServer,
		isAssetsSettingsOpen,
		setIsAssetsSettingsOpen,
		isAgentCreatedAssetsOpen,
		setIsAgentCreatedAssetsOpen,
		openAssetMenuId,
		setOpenAssetMenuId,
		expandedAssetId,
		setExpandedAssetId,
		addAssets,
		confirmAndRemoveAsset,
		downloadAsset,
		uploadedAssets,
		agentCreatedAssets,
		isUserContextSettingsOpen,
		setIsUserContextSettingsOpen,
		userContexts,
		showUserContextForm,
		setShowUserContextForm,
		editingUserContextId,
		userContextName,
		setUserContextName,
		userContextContent,
		setUserContextContent,
		openUserContextMenuId,
		setOpenUserContextMenuId,
		saveUserContext,
		startEditUserContext,
		clearUserContextEditor,
		deleteUserContextById,
		isPromptTemplatesSettingsOpen,
		setIsPromptTemplatesSettingsOpen,
		templates,
		activeTemplateId,
		setActiveTemplateId,
		editingTemplateId,
		templateName,
		setTemplateName,
		templateContent,
		setTemplateContent,
		showTemplateForm,
		setShowTemplateForm,
		openTemplateMenuId,
		setOpenTemplateMenuId,
		saveTemplate,
		startEditTemplate,
		clearTemplateEditor,
		deleteTemplateById,
		isSkillsSettingsOpen,
		setIsSkillsSettingsOpen,
		showSkillForm,
		setShowSkillForm,
		editingSkillId,
		skillContent,
		setSkillContent,
		openSkillMenuId,
		setOpenSkillMenuId,
		saveSkill,
		startEditSkill,
		clearSkillEditor,
		deleteSkillById,
		skills,
		isDark,
		inputClass,
		panelClass,
		labelClass,
		subtleClass,
		secondaryButtonClass,
	} = p;

	return (
		<div
			className={`w-full h-screen p-4 font-sans overflow-y-auto ${
				isDark ? 'bg-gpt-canvas text-gpt-text' : 'bg-gpt-canvas text-gpt-text'
			}`}
			style={{ colorScheme: isDark ? 'dark' : 'light' }}
		>
			{/* Discard Dialog */}
			{showDiscardDialog && (
				<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
					<div className={`rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl ${isDark ? 'bg-gpt-surface border border-gpt-border' : 'bg-gpt-surface border border-gpt-border'}`}>
						<div className='text-sm font-semibold mb-2 text-gpt-text'>Unsaved Changes</div>
						<div className={`text-xs mb-5 ${subtleClass}`}>You have unsaved runtime control changes. Discard them?</div>
						<div className='flex gap-2'>
							<button
								onClick={confirmDiscardSettings}
								className='flex-1 bg-gpt-danger text-white rounded-lg px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity'
							>
								Discard Changes
							</button>
							<button
								onClick={() => setShowDiscardDialog(false)}
								className={`flex-1 rounded-lg px-4 py-2 text-xs font-medium ${secondaryButtonClass}`}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Back button + title */}
			<div className='flex items-center gap-3 mb-4'>
				<button
					onClick={attemptLeaveSettings}
					className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${secondaryButtonClass}`}
				>
					<span className='text-sm'>←</span> Back
				</button>
				<h2 className='text-lg font-bold'>Agent Settings</h2>
			</div>

			<div className='space-y-6'>
				{/* Models Settings */}
				<div className={`${panelClass} rounded-lg p-4`}>
					<button
						onClick={() => setIsModelsSettingsOpen((v) => !v)}
						className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
					>
						<span>Models Settings</span>
						<ChevronIcon open={isModelsSettingsOpen} />
					</button>
					{isModelsSettingsOpen && (
						<div className='space-y-3'>
							<div className='flex items-center justify-between gap-2'>
								<div className={`text-xs ${subtleClass}`}>
									{modelConfigs.length} model{modelConfigs.length !== 1 ? 's' : ''} configured
								</div>
								<button
									onClick={() => {
										clearModelForm();
										setShowModelForm(true);
									}}
									className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
								>
									Add Model
								</button>
							</div>
							{modelConfigs.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No models yet. Add one to get started.</div>
							) : (
								<div className='space-y-2'>
									{modelConfigs.map((config) => (
										<div
											key={config.id}
											className={`relative rounded px-3 py-2 text-xs border ${
												activeModelId === config.id
													? 'border-gpt-accent bg-gpt-accent/10'
													: isDark
													? 'bg-gpt-surface border-gpt-border'
													: 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<button
													onClick={() => setActiveModelId(config.id)}
													className='flex-1 text-left min-w-0'
												>
													<div className='font-semibold truncate flex items-center gap-2'>
														{config.name}
														{activeModelId === config.id && (
															<span className='text-[10px] text-gpt-accent font-normal'>active</span>
														)}
													</div>
													<div className={`${subtleClass} truncate`}>{config.modelName}</div>
													<div className={`${subtleClass} text-[11px] truncate`}>{config.baseUrl}</div>
													{config.supportsVision && (
														<div className='text-[10px] text-gpt-accent mt-0.5'>vision enabled</div>
													)}
												</button>
												<div className='flex items-center gap-1'>
													<button
														onClick={() => startEditModelConfig(config.id)}
														className={`text-xs px-2 py-1 rounded border ${secondaryButtonClass}`}
													>
														Edit
													</button>
													<button
														onClick={() => deleteModelConfigById(config.id)}
														className='text-xs px-2 py-1 rounded border border-gpt-danger/40 text-gpt-danger hover:bg-gpt-danger-soft'
													>
														Delete
													</button>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
							{showModelForm && (
								<div className={`space-y-3 rounded-lg border p-3 ${isDark ? 'border-gpt-border bg-gpt-sidebar/30' : 'border-gpt-border bg-gpt-surface/50'}`}>
									<div className={`text-xs font-semibold ${labelClass}`}>
										{editingModelId ? 'Edit Model' : 'New Model'}
									</div>
									<div>
										<label className={`block text-xs mb-1 ${labelClass}`}>Display Name</label>
										<input
											className={inputClass}
											value={modelFormName}
											onChange={(e) => setModelFormName(e.target.value)}
											placeholder='e.g. Ollama Local'
										/>
									</div>
									<div>
										<label className={`block text-xs mb-1 ${labelClass}`}>Base URL</label>
										<input
											className={inputClass}
											value={modelFormBaseUrl}
											onChange={(e) => setModelFormBaseUrl(e.target.value)}
											placeholder='http://localhost:11434/v1'
										/>
									</div>
									<div>
										<label className={`block text-xs mb-1 ${labelClass}`}>API Key</label>
										<input
											type='password'
											className={inputClass}
											value={modelFormApiKey}
											onChange={(e) => setModelFormApiKey(e.target.value)}
										/>
									</div>
									<div>
										<div className='flex justify-between items-center mb-1'>
											<label className={`block text-xs ${labelClass}`}>Model Name</label>
											<div className='flex items-center gap-3'>
												<label className={`flex items-center gap-1 text-[11px] ${subtleClass}`}>
													<input
														type='checkbox'
														className='accent-gpt-accent'
														checked={modelFormUseManual}
														onChange={(e) => setModelFormUseManual(e.target.checked)}
													/>
													Manual
												</label>
												<button
													onClick={fetchModelsForForm}
													className='text-[11px] text-gpt-accent hover:text-gpt-accent-hover'
												>
													↻ Fetch
												</button>
											</div>
										</div>
										{!modelFormUseManual && modelFormAvailableModels.length > 0 ? (
											<select
												className={inputClass}
												value={modelFormModelName}
												onChange={(e) => setModelFormModelName(e.target.value)}
											>
												<option value=''>Select a model</option>
												{modelFormAvailableModels.map((m) => (
													<option key={m} value={m}>{m}</option>
												))}
											</select>
										) : (
											<input
												className={inputClass}
												value={modelFormModelName}
												onChange={(e) => setModelFormModelName(e.target.value)}
												placeholder='e.g. gpt-4o'
											/>
										)}
									</div>
									<label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gpt-text' : 'text-gpt-text'}`}>
										<input
											type='checkbox'
											className='accent-gpt-accent'
											checked={modelFormSupportsVision}
											onChange={(e) => setModelFormSupportsVision(e.target.checked)}
										/>
										Vision support
									</label>
									<div className='flex items-center gap-2'>
										<button
											onClick={saveModelConfig}
											className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'
										>
											{editingModelId ? 'Update Model' : 'Save Model'}
										</button>
										<button
											onClick={clearModelForm}
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

				{/* Runtime Controls */}
				<div className={`${panelClass} rounded-lg p-4`}>
					<button
						onClick={() => setIsRuntimeControlsOpen((v) => !v)}
						className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
					>
						<span>Runtime Controls</span>
						<ChevronIcon open={isRuntimeControlsOpen} />
					</button>
					{isRuntimeControlsOpen && (
						<div className='grid grid-cols-1 gap-3'>
							<div>
								<label className={`block text-xs mb-1 ${labelClass}`}>Max Steps</label>
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
								<label className={`block text-xs mb-1 ${labelClass}`}>Model Request Timeout (ms)</label>
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
								<label className={`block text-xs mb-1 ${labelClass}`}>Delay Between Steps (ms)</label>
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
								<label className={`block text-xs mb-1 ${labelClass}`}>Invalid Retry Base Delay (ms)</label>
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
								<label className={`block text-xs mb-1 ${labelClass}`}>Invalid Retry Increment (ms)</label>
								<input
									type='number'
									min={0}
									className={inputClass}
									value={invalidRetryIncrementMs}
									onChange={(e) => {
										const next = Number(e.target.value);
										setInvalidRetryIncrementMs(Number.isFinite(next) ? next : 0);
									}}
								/>
							</div>
							<div>
								<label className={`block text-xs mb-1 ${labelClass}`}>Invalid Retry Max Delay (ms)</label>
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
								<label className={`block text-xs mb-1 ${labelClass}`}>Max Consecutive Failures</label>
								<input
									type='number'
									min={1}
									className={inputClass}
									value={maxConsecutiveFailures}
									onChange={(e) => {
										const next = Number(e.target.value);
										setMaxConsecutiveFailures(Number.isFinite(next) ? next : 1);
									}}
								/>
							</div>
						</div>
					)}
				</div>

				{/* MCP Servers */}
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
								<div className={`text-xs ${subtleClass}`}>No MCP servers configured.</div>
							) : (
								<div className='space-y-2'>
									{mcpServers.map((server) => (
										<div
											key={server.id}
											className={`relative rounded px-2 py-2 text-xs border ${
												isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<div className='truncate'>
													<div className='font-semibold truncate'>{server.name}</div>
													<div className={subtleClass}>{server.url}</div>
													{mcpTestResultById[server.id] ? (
														<div
															className={`text-[11px] mt-1 ${
																mcpTestResultById[server.id].startsWith('Connected')
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
													<label className={`flex items-center gap-1 ${subtleClass}`} title='Enable or disable this MCP server'>
														<input
															type='checkbox'
															checked={server.enabled}
															onChange={() => toggleMcpServer(server.id)}
														/>
														Enabled
													</label>
													<button
														onClick={() => setOpenMcpMenuId((prev) => (prev === server.id ? null : server.id))}
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
														isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button
														onClick={() => { setOpenMcpMenuId(null); startEditMcpServer(); }}
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

				{/* Assets */}
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
							<label className={`cursor-pointer text-xs ${isDark ? 'text-gpt-accent' : 'text-gpt-warning'}`}>
								＋ Add Assets
								<input type='file' className='hidden' multiple onChange={(e) => addAssets(e.target.files)} />
							</label>
							{uploadedAssets.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No uploaded assets yet.</div>
							) : (
								<div className='space-y-2'>
									{uploadedAssets.map((asset) => (
										<div
											key={asset.id}
											className={`relative rounded px-2 py-2 text-xs ${
												isDark ? 'bg-gpt-surface border border-gpt-border' : 'bg-gpt-canvas border border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<div className='truncate'>
													<div className='truncate'>{asset.name}</div>
													<div className={`${subtleClass} text-[11px]`}>
														{asset.type} | {asset.size} bytes | uploaded
													</div>
												</div>
												<button
													onClick={() => setOpenAssetMenuId((prev) => (prev === asset.id ? null : asset.id))}
													className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
													title='Actions'
												>
													<MoreVerticalIcon />
												</button>
											</div>
											{openAssetMenuId === asset.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-surface border-gpt-border'
													}`}
												>
													{asset.type.startsWith('text/') && (
														<button
															onClick={() => {
																setExpandedAssetId((prev) => (prev === asset.id ? null : asset.id));
																setOpenAssetMenuId(null);
															}}
															className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
														>
															{expandedAssetId === asset.id ? 'Hide' : 'View'}
														</button>
													)}
													<button onClick={() => downloadAsset(asset)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'>Download</button>
													<button onClick={() => confirmAndRemoveAsset(asset)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'>Delete</button>
												</div>
											)}
											{expandedAssetId === asset.id ? (
												<pre className={`mt-2 p-2 rounded whitespace-pre-wrap break-words text-[11px] max-h-44 overflow-y-auto ${
													isDark ? 'bg-gpt-overlay border border-gpt-border' : 'bg-gpt-surface border border-gpt-border'
												}`}>
													{decodeDataUrlText(asset.dataUrl)}
												</pre>
											) : null}
										</div>
									))}
								</div>
							)}
							<div className={`text-xs ${subtleClass}`}>Use @ to reference assets by name in tasks.</div>
						</div>
					)}
				</div>

				{/* Agent Created Assets */}
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
								<div className={`text-xs ${subtleClass}`}>No agent-created assets yet.</div>
							) : (
								<div className='space-y-2'>
									{agentCreatedAssets.map((asset) => (
										<div
											key={asset.id}
											className={`relative rounded px-2 py-2 text-xs ${
												isDark ? 'bg-gpt-surface border border-gpt-border' : 'bg-gpt-canvas border border-gpt-border'
											}`}
										>
											<div className='flex items-center justify-between gap-2'>
												<div className='truncate'>
													<div className='truncate'>{asset.name}</div>
													<div className={`${subtleClass} text-[11px]`}>
														{asset.type} | {asset.size} bytes | generated
													</div>
												</div>
												<button
													onClick={() => setOpenAssetMenuId((prev) => (prev === asset.id ? null : asset.id))}
													className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
													title='Actions'
												>
													<MoreVerticalIcon />
												</button>
											</div>
											{openAssetMenuId === asset.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-surface border-gpt-border'
													}`}
												>
													{asset.type.startsWith('text/') && (
														<button
															onClick={() => {
																setExpandedAssetId((prev) => (prev === asset.id ? null : asset.id));
																setOpenAssetMenuId(null);
															}}
															className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'
														>
															{expandedAssetId === asset.id ? 'Hide' : 'View'}
														</button>
													)}
													<button onClick={() => downloadAsset(asset)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'>Download</button>
													<button onClick={() => confirmAndRemoveAsset(asset)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'>Delete</button>
												</div>
											)}
											{expandedAssetId === asset.id ? (
												<pre className={`mt-2 p-2 rounded whitespace-pre-wrap break-words text-[11px] max-h-44 overflow-y-auto ${
													isDark ? 'bg-gpt-overlay border border-gpt-border' : 'bg-gpt-surface border border-gpt-border'
												}`}>
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

				{/* User Context */}
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
								<div className={`text-xs ${subtleClass}`}>Create reusable identity/context blocks.</div>
								<button
									onClick={() => { clearUserContextEditor(); setShowUserContextForm(true); }}
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
												isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-start justify-between gap-2'>
												<div className='min-w-0'>
													<div className='font-semibold truncate'>{context.name}</div>
													<div className={`${subtleClass} line-clamp-2`}>{context.content}</div>
												</div>
												<button
													onClick={() => setOpenUserContextMenuId((prev) => (prev === context.id ? null : context.id))}
													className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
													title='Actions'
												>
													<MoreVerticalIcon />
												</button>
											</div>
											{openUserContextMenuId === context.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button onClick={() => startEditUserContext(context.id)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'>Edit</button>
													<button onClick={() => deleteUserContextById(context.id)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'>Delete</button>
												</div>
											)}
										</div>
									))}
								</div>
							)}
							{showUserContextForm && (
								<div className='space-y-2'>
									<input className={inputClass} value={userContextName} onChange={(e) => setUserContextName(e.target.value)} placeholder='Context name or identity' />
									<textarea className={inputClass} rows={8} value={userContextContent} onChange={(e) => setUserContextContent(e.target.value)} placeholder='Context content' />
									<div className='flex items-center gap-2'>
										<button onClick={saveUserContext} className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'>
											{editingUserContextId ? 'Update Context' : 'Save Context'}
										</button>
										<button onClick={clearUserContextEditor} className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}>Cancel</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Prompt Templates */}
				<div className={`${panelClass} rounded-lg p-4`}>
					<button
						onClick={() => setIsPromptTemplatesSettingsOpen((v) => !v)}
						className='w-full flex items-center justify-between text-xs font-semibold text-gpt-muted mb-3 uppercase tracking-wide'
					>
						<span>Prompt Templates</span>
						<ChevronIcon open={isPromptTemplatesSettingsOpen} />
					</button>
					{isPromptTemplatesSettingsOpen && (
						<div className='space-y-3'>
							<div className='flex items-center justify-between gap-2'>
								<div className={`text-xs ${subtleClass}`}>
									Active: {templates.find(t => t.id === activeTemplateId)?.name || 'None'}
								</div>
								<button
									onClick={() => { clearTemplateEditor(); setShowTemplateForm(true); }}
									className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}
								>
									New Template
								</button>
							</div>
							{templates.length > 0 && (
								<div>
									<label className={`block text-xs mb-1 ${labelClass}`}>Active Template</label>
									<select
										className={inputClass}
										value={activeTemplateId}
										onChange={(e) => setActiveTemplateId(e.target.value)}
									>
										<option value=''>None</option>
										{templates.map((t) => (
											<option key={t.id} value={t.id}>{t.name}</option>
										))}
									</select>
								</div>
							)}
							{templates.length === 0 ? (
								<div className={`text-xs ${subtleClass}`}>No templates yet.</div>
							) : (
								<div className='space-y-2'>
									{templates.map((t) => (
										<div
											key={t.id}
											className={`relative rounded px-2 py-2 text-xs border ${
												isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-start justify-between gap-2'>
												<div className='min-w-0'>
													<div className='font-semibold truncate'>{t.name}</div>
													<div className={`${subtleClass} line-clamp-2`}>{t.content}</div>
												</div>
												<button
													onClick={() => setOpenTemplateMenuId(openTemplateMenuId === t.id ? null : t.id)}
													className='inline-flex h-8 w-8 items-center justify-center rounded-lg text-gpt-muted hover:text-gpt-text hover:bg-gpt-elevated transition-colors'
													title='Actions'
												>
													<MoreVerticalIcon />
												</button>
											</div>
											{openTemplateMenuId === t.id && (
												<div
													className={`absolute right-2 top-10 z-20 min-w-[8.5rem] rounded-lg border p-1 text-xs shadow-lg ${
														isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button onClick={() => { setOpenTemplateMenuId(null); startEditTemplate(t.id); }} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'>Edit</button>
													<button onClick={() => deleteTemplateById(t.id)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'>Delete</button>
												</div>
											)}
										</div>
									))}
								</div>
							)}
							{showTemplateForm && (
								<div className='space-y-2'>
									<input className={inputClass} value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder='Template name' />
									<textarea
										className={inputClass}
										rows={6}
										value={templateContent}
										onChange={(e) => setTemplateContent(e.target.value)}
										placeholder='Template content...'
									/>
									<div className='flex items-center gap-2'>
										<button onClick={saveTemplate} className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'>
											{editingTemplateId ? 'Update Template' : 'Save Template'}
										</button>
										<button onClick={clearTemplateEditor} className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}>Cancel</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Skills */}
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
								<div className={`text-xs ${subtleClass}`}>Use in task: <span className='text-gpt-text'>@skill:SkillName</span></div>
								<button
									onClick={() => { clearSkillEditor(); setShowSkillForm(true); }}
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
												isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-canvas border-gpt-border'
											}`}
										>
											<div className='flex items-start justify-between gap-2'>
												<div className='min-w-0'>
													<div className='font-semibold truncate'>{skill.name}</div>
													<div className={`${subtleClass} line-clamp-2`}>
														{skill.source === 'predefined' ? `Predefined file skill (${skill.filePath || 'SKILL.md'})` : skill.content}
													</div>
												</div>
												{skill.source === 'user' && (
													<button
														onClick={() => setOpenSkillMenuId((prev) => (prev === skill.id ? null : skill.id))}
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
														isDark ? 'bg-gpt-surface border-gpt-border' : 'bg-gpt-surface border-gpt-border'
													}`}
												>
													<button onClick={() => startEditSkill(skill.id)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-elevated text-gpt-text'>Edit</button>
													<button onClick={() => deleteSkillById(skill.id)} className='block w-full text-left px-2 py-1.5 rounded hover:bg-gpt-danger-soft text-gpt-danger'>Delete</button>
												</div>
											)}
										</div>
									))}
								</div>
							)}
							{showSkillForm && (
								<div className='space-y-2'>
									<textarea className={inputClass} rows={12} value={skillContent} onChange={(e) => setSkillContent(e.target.value)} placeholder='Write skill template...' />
									<div className='flex items-center gap-2'>
										<button onClick={saveSkill} className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-3 py-1.5 text-xs'>
											{editingSkillId ? 'Update Skill' : 'Save Skill'}
										</button>
										<button onClick={clearSkillEditor} className={`text-xs px-3 py-1.5 rounded border ${secondaryButtonClass}`}>Cancel</button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Save & Cancel */}
				<div className='flex gap-2 pt-2'>
					<button
						onClick={saveSettings}
						className='bg-gpt-accent hover:bg-gpt-accent-hover text-gpt-on-accent rounded px-4 py-2 text-sm flex-1'
					>
						Save & Close
					</button>
					<button
						onClick={attemptLeaveSettings}
						className={`${secondaryButtonClass} rounded px-4 py-2 text-sm`}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
};

export default AgentSettingsScreen;
