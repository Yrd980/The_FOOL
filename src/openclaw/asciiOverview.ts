import {
  buildOpenClawAsciiReadModel,
  type BuildOpenClawAsciiReadModelArgs,
} from "./asciiOverviewReadModel";
import { renderOpenClawAsciiOverview } from "./asciiOverviewRender";

export const buildOpenClawAsciiOverview = (
  args: BuildOpenClawAsciiReadModelArgs,
): string => renderOpenClawAsciiOverview(buildOpenClawAsciiReadModel(args));
