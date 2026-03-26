import iconStrokeClass from '../iconStrokeClass';

const ZoomOutIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<circle className={iconStrokeClass} cx='11' cy='11' r='7' strokeWidth='1.8' />
		<path className={iconStrokeClass} d='M8.5 11h5' strokeWidth='1.8' strokeLinecap='round' />
		<path className={iconStrokeClass} d='M16.5 16.5L21 21' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

export default ZoomOutIcon;
