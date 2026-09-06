import Input from "@/components/ui/Input";

type FieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	description?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">;

export default function Field({
	id,
	label,
	value,
	onChange,
	description,
	...props
}: FieldProps) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-2 block text-sm font-medium text-zinc-300"
			>
				{label}
			</label>

			<Input
				{...props}
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>

			{description && (
				<p className="mt-2 text-xs text-zinc-600">{description}</p>
			)}
		</div>
	);
}
