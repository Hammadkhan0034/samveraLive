import React from "react";

export type Detail = {
  label: string;
  value: string | number;
};

type Props = {
  title?: string;
  details: Detail[];
};

export default function DepartmentDetails({ title = "Deild", details }: Props) {
  return (
    <div className="bg-white shadow-ds-card rounded-ds-lg overflow-hidden dark:bg-slate-800">
      <div className="bg-mint-500 px-4 py-2 text-white font-semibold">{title}</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 text-sm">
        {details.map((item, idx) => (
          <React.Fragment key={idx}>
            <dt className="font-medium text-gray-600">{item.label}</dt>
            <dd className="text-gray-900">{item.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
