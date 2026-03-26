import coerceDecisionShape from './coerceDecisionShape';

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

export default normalizeDecision;
