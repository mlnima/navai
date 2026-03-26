import iconStrokeClass from '../iconStrokeClass';

const NewChatIcon = () => (
	<svg viewBox='0 0 24 24' fill='none' className='h-5 w-5 shrink-0'>
		<rect className={iconStrokeClass} x='4' y='4' width='16' height='16' rx='3' strokeWidth='1.8' />
		<path className={iconStrokeClass} d='M12 8v8M8 12h8' strokeWidth='1.8' strokeLinecap='round' />
	</svg>
);

export default NewChatIcon;
