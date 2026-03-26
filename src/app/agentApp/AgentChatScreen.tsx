import { parseAgentMessage } from '../../utils/parseAgentMessage';
import ZoomOutIcon from '../icons/ZoomOutIcon';
import ZoomInIcon from '../icons/ZoomInIcon';
import TemplatesIcon from '../icons/TemplatesIcon';
import HistoryIcon from '../icons/HistoryIcon';
import NewChatIcon from '../icons/NewChatIcon';
import SettingsIcon from '../icons/SettingsIcon';
import type { AgentAppModel } from './useAgentApp';

const AgentChatScreen = (p: AgentAppModel) => {
	const {
		task,
		setTask,
		messages,
		isRunning,
		setShowSettings,
		interactionMode,
		setInteractionMode,
		modelName,
		templates,
		activeTemplateId,
		setActiveTemplateId,
		editingTemplateId,
		templateName,
		setTemplateName,
		templateContent,
		setTemplateContent,
		attachedFiles,
		assets,
		showTemplatePanel,
		setShowTemplatePanel,
		showHistoryPanel,
		setShowHistoryPanel,
		uiZoom,
		isDark,
		showTemplateForm,
		setShowTemplateForm,
		openTemplateMenuId,
		setOpenTemplateMenuId,
		showAssetSuggestions,
		setShowAssetSuggestions,
		assetQuery,
		setAssetQuery,
		userContexts,
		selectedUserContextIds,
		showUserContextPicker,
		setShowUserContextPicker,
		waitingForUserAction,
		clearSession,
		saveTemplate,
		startEditTemplate,
		clearTemplateEditor,
		deleteTemplateById,
		toggleSelectedUserContext,
		addFiles,
		removeFile,
		startNewChat,
		runCurrentMode,
		continueAfterUserAction,
		computeAssetSuggestions,
		applyAssetMention,
		zoomOut,
		zoomIn,
		bottomRef,
		inputRef,
		inputClass,
		panelClass,
		labelClass,
		subtleClass,
		secondaryButtonClass,
		iconButtonClass,
		iconButtonActiveClass,
		activeTemplateDisplay,
	} = p;
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

export default AgentChatScreen;
