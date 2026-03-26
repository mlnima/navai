import iconStrokeClass from '../iconStrokeClass';

const ChevronIcon = ({ open }: { open: boolean }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
	>
		<path
			className={iconStrokeClass}
			d='M6 9l6 6 6-6'
			strokeWidth='1.8'
			strokeLinecap='round'
			strokeLinejoin='round'
		/>
	</svg>
);

export default ChevronIcon;
