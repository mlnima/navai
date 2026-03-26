import iconStrokeClass from '../iconStrokeClass';

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

export default SettingsIcon;
