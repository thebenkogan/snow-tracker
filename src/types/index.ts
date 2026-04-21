export interface Dish {
  name: string;
  ingredients: string[];
  allergens: string[];
}

export interface DayMenu {
  day: string;
  date: string;
  dishes: Dish[];
}

export interface Station {
  id: string;
  name: string;
  imageUrl: string;
  menu: DayMenu[];
}

export interface MealLog {
  id: string;
  date: string;
  stationId: string;
  stationName: string;
  selectedDishes: string[];
  selectedIngredients: string[];
  imageUrl: string;
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  createdAt: string;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
  runCount: number;
}
