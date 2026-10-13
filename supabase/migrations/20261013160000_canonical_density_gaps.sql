-- Density gaps (ADR 0021 follow-up). These global ingredients are sized by
-- weight but routinely measured by volume in recipes ("1 tsp paprika", "1 cup
-- shredded cheddar", "1 cup salsa"). Without a density, a volume amount can't be
-- converted to their package unit, so the ingredient goes unpriced and won't
-- merge with a weight amount on the list. Values (g/ml) are standard
-- cup/spoon weights for the form recipes use: shredded/grated/crumbled cheese,
-- drained canned beans, ground spices, short dry pasta, chopped/sliced produce.
-- Only fills blanks; a deliberate value is never overwritten. Cuts of meat,
-- fish, doughs and crackers aren't measured by volume and are left alone.

update public.canonical_ingredient c
set density_g_per_ml = v.density
from (values
  -- Spices & seasonings (1 tsp ≈ 4.93 ml)
  ('apple pie spice', 0.35), ('cajun seasoning', 0.53), ('caraway seeds', 0.43),
  ('cardamom', 0.41), ('chinese five spice', 0.41), ('curry powder', 0.41),
  ('dried basil', 0.14), ('dried parsley', 0.10), ('dried rosemary', 0.24),
  ('dried sage', 0.14), ('dried thyme', 0.20), ('everything bagel seasoning', 0.61),
  ('fennel seeds', 0.41), ('garam masala', 0.41), ('garlic salt', 1.01),
  ('ground allspice', 0.39), ('ground cloves', 0.43), ('ground coriander', 0.37),
  ('ground ginger', 0.37), ('herbs de provence', 0.20), ('kosher salt', 0.73),
  ('lemon pepper', 0.51), ('mustard seeds', 0.67), ('old bay seasoning', 0.49),
  ('paprika', 0.47), ('poultry seasoning', 0.30), ('pumpkin pie spice', 0.35),
  ('ranch seasoning', 0.59), ('sea salt', 1.10), ('sesame seeds', 0.61),
  ('taco seasoning', 0.57), ('white pepper', 0.49), ('cream of tartar', 0.64),
  ('espresso powder', 0.40), ('unflavored gelatin', 0.63),
  ('ground coffee', 0.36), ('coffee beans', 0.38),
  -- Canned & jarred
  ('applesauce', 1.04), ('artichoke hearts', 0.70), ('black beans', 0.73),
  ('black olives', 0.57), ('black-eyed peas', 0.73), ('canned corn', 0.70),
  ('canned crushed tomatoes', 1.05), ('canned diced tomatoes', 1.00),
  ('canned green beans', 0.55), ('canned peas', 0.70), ('canned whole tomatoes', 1.00),
  ('cannellini beans', 0.73), ('chickpeas', 0.69), ('chipotle in adobo', 1.00),
  ('coconut milk', 0.98), ('cranberry sauce', 1.10), ('cream of celery soup', 1.05),
  ('cream of chicken soup', 1.05), ('cream of mushroom soup', 1.05),
  ('diced green chiles', 1.00), ('dill pickles', 0.60), ('enchilada sauce', 1.05),
  ('evaporated milk', 1.07), ('fire roasted tomatoes', 1.00),
  ('great northern beans', 0.73), ('green olives', 0.57), ('kalamata olives', 0.57),
  ('kidney beans', 0.73), ('lima beans', 0.73), ('navy beans', 0.73),
  ('pinto beans', 0.73), ('pumpkin puree', 1.00), ('refried beans', 1.05),
  ('roasted red peppers', 0.80), ('sauerkraut', 0.60), ('sun-dried tomatoes', 0.50),
  ('sweetened condensed milk', 1.30), ('tomato puree', 1.05), ('tomato sauce', 1.05),
  ('tomato soup', 1.05), ('tuna', 0.60), ('water chestnuts', 0.60),
  ('capers', 0.60), ('pickle relish', 1.00), ('salsa', 1.05), ('guacamole', 1.00),
  ('hummus', 1.05),
  -- Cheese, as shredded/grated/crumbled
  ('blue cheese', 0.57), ('cheddar cheese', 0.48), ('colby jack cheese', 0.48),
  ('cotija cheese', 0.50), ('feta cheese', 0.63), ('goat cheese', 0.60),
  ('gouda cheese', 0.45), ('gruyere cheese', 0.42), ('monterey jack cheese', 0.48),
  ('mozzarella cheese', 0.47), ('parmesan cheese', 0.42), ('pepper jack cheese', 0.48),
  ('provolone cheese', 0.45), ('queso fresco', 0.60), ('swiss cheese', 0.45),
  ('whipped cream', 0.25), ('whipped topping', 0.32),
  -- Frozen
  ('edamame', 0.66), ('frozen berries', 0.60), ('frozen blueberries', 0.63),
  ('frozen broccoli', 0.38), ('frozen corn', 0.66), ('frozen hash browns', 0.35),
  ('frozen mango', 0.70), ('frozen mixed vegetables', 0.57), ('frozen peas', 0.61),
  ('frozen spinach', 0.66), ('frozen strawberries', 0.64),
  -- Produce, chopped/sliced/whole as measured
  ('arugula', 0.08), ('asparagus', 0.57), ('baby spinach', 0.13), ('bean sprouts', 0.44),
  ('blackberries', 0.61), ('blueberries', 0.63), ('brussels sprouts', 0.37),
  ('cherries', 0.65), ('cherry tomatoes', 0.63), ('collard greens', 0.15),
  ('cranberries', 0.42), ('cremini mushroom', 0.30), ('fresh basil', 0.10),
  ('fresh chives', 0.20), ('fresh dill', 0.04), ('fresh mint', 0.14),
  ('fresh oregano', 0.10), ('fresh rosemary', 0.15), ('fresh sage', 0.10),
  ('fresh thyme', 0.16), ('ginger', 0.41), ('grapes', 0.64), ('green beans', 0.42),
  ('mixed greens', 0.08), ('mushrooms', 0.30), ('okra', 0.42), ('radish', 0.49),
  ('raspberries', 0.52), ('rhubarb', 0.51), ('shiitake mushroom', 0.30),
  ('snap peas', 0.42), ('snow peas', 0.27), ('spinach', 0.13), ('strawberries', 0.64),
  ('swiss chard', 0.15),
  -- Short dry pasta & noodles (long pasta isn't measured by the cup)
  ('egg noodles', 0.16), ('elbow macaroni', 0.44), ('farfalle', 0.32), ('gnocchi', 0.60),
  ('orzo', 0.80), ('pasta', 0.42), ('penne', 0.42), ('rigatoni', 0.38), ('rotini', 0.36),
  -- Seeds, nuts, dried fruit, breakfast
  ('chia seeds', 0.81), ('flax seeds', 0.68), ('hazelnuts', 0.57), ('pine nuts', 0.57),
  ('cashews', 0.58), ('dried apricots', 0.55), ('mixed nuts', 0.58), ('peanuts', 0.62),
  ('pistachios', 0.52), ('pumpkin seeds', 0.55), ('sunflower seeds', 0.59),
  ('granola', 0.50), ('cereal', 0.15), ('cornflakes', 0.12), ('pancake mix', 0.53),
  ('brownie mix', 0.60), ('cake mix', 0.50)
) as v (name, density)
where c.name = v.name
  and c.household_id is null
  and c.density_g_per_ml is null;
