import { Category, HazardSubcategory, RiskLevel } from "@safetywallet/types";

export const categoryOptions = [
  { value: Category.HAZARD, label: "posts.category.hazard", icon: "⚠️" },
  {
    value: Category.UNSAFE_BEHAVIOR,
    label: "posts.category.unsafeBehavior",
    icon: "🚨",
  },
  {
    value: Category.INCONVENIENCE,
    label: "posts.category.inconvenience",
    icon: "🛠️",
  },
  {
    value: Category.SUGGESTION,
    label: "posts.category.suggestion",
    icon: "💡",
  },
];

export const riskOptions = [
  {
    value: RiskLevel.HIGH,
    label: "actions.priority.high",
    color: "bg-red-100 border-red-500 text-red-700",
  },
  {
    value: RiskLevel.MEDIUM,
    label: "actions.priority.medium",
    color: "bg-yellow-100 border-yellow-500 text-yellow-700",
  },
  {
    value: RiskLevel.LOW,
    label: "actions.priority.low",
    color: "bg-green-100 border-green-500 text-green-700",
  },
];

export const hazardSubcategoryOptions: {
  value: HazardSubcategory;
  label: string;
}[] = [
  { value: HazardSubcategory.FALL, label: "posts.new.hazardSubcategory_FALL" },
  {
    value: HazardSubcategory.COLLAPSE,
    label: "posts.new.hazardSubcategory_COLLAPSE",
  },
  {
    value: HazardSubcategory.STRUCK_BY,
    label: "posts.new.hazardSubcategory_STRUCK_BY",
  },
  {
    value: HazardSubcategory.CAUGHT_IN,
    label: "posts.new.hazardSubcategory_CAUGHT_IN",
  },
  {
    value: HazardSubcategory.ELECTROCUTION,
    label: "posts.new.hazardSubcategory_ELECTROCUTION",
  },
  { value: HazardSubcategory.FIRE, label: "posts.new.hazardSubcategory_FIRE" },
  {
    value: HazardSubcategory.CHEMICAL,
    label: "posts.new.hazardSubcategory_CHEMICAL",
  },
  {
    value: HazardSubcategory.OTHER,
    label: "posts.new.hazardSubcategory_OTHER",
  },
];
