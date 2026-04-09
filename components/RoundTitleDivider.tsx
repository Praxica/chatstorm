import { RoundIcon } from '@/components/rounds/RoundIcon';
import type { Round } from '@/types/config-round';

interface RoundTitleDividerProps {
  roundTitle: string;
  roundData?: Round;
}

export function RoundTitleDivider({ roundTitle, roundData }: RoundTitleDividerProps) {
  return (
    <div className="mb-6 mt-8 first:mt-0">
      <div className="flex items-center justify-center mb-4">
        <div className="flex-1 border-t border-gray-300"></div>
        <div className="px-4 py-2 bg-gray-50 rounded-full border border-gray-200">
          <div className="flex items-center gap-2">
            {roundData && (
              <RoundIcon
                iconName={(roundData as any).icon}
                roundType={roundData.type}
                className="h-4 w-4 text-blue-500"
              />
            )}
            <h3 className="text-sm font-semibold text-gray-600 whitespace-nowrap">
              {roundTitle}
            </h3>
          </div>
        </div>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>
    </div>
  );
}
