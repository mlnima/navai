import useAgentApp from './useAgentApp';
import AgentSettingsScreen from './AgentSettingsScreen';
import AgentChatScreen from './AgentChatScreen';

const AgentApp = () => {
	const m = useAgentApp();
	if (m.showSettings) return <AgentSettingsScreen {...m} />;
	return <AgentChatScreen {...m} />;
};

export default AgentApp;
