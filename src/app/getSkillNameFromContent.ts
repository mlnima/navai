const getSkillNameFromContent = (content: string) => {
	const raw = content.trim();
	if (!raw) return '';
	const nameMatch = raw.match(/^\s*name\s*:\s*(.+)$/im);
	if (nameMatch?.[1]) return nameMatch[1].trim();
	const headingMatch = raw.match(/^\s*#\s*(.+)$/m);
	if (headingMatch?.[1]) return headingMatch[1].trim();
	return '';
};

export default getSkillNameFromContent;
