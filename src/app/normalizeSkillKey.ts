const normalizeSkillKey = (value: string) =>
	value.toLowerCase().replace(/[^a-z0-9]/g, '');

export default normalizeSkillKey;
