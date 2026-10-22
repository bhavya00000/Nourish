// Seed food database.
// One compact row per food keeps this readable:
//   [ name, aliases("|"), kcal, protein, carbs, fat, units("unit:grams|..."), veg, cuisine, tags("|") ]
// Macros are per 100 g (or per 100 ml for drinks). Unit weights are the edible
// weight of one serving, so "2 roti" resolves to 2 x 40 g.
// The first unit listed is the default when the user does not name one.

export type SeedFood = {
  name: string;
  aliases: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  units: { name: string; grams: number }[];
  veg: boolean;
  cuisine: string;
  tags: string[];
};

type Row = [string, string, number, number, number, number, string, number, string, string];

const ROWS = [
  // ---------- Indian breads & grains ----------
  ["Roti / Chapati (whole wheat)","roti|chapati|chapathi|phulka|fulka|wheat roti|indian bread",297,11,58,4,"piece:40|g:1",1,"indian","grain|staple"],
  ["Tandoori Roti","tandoori chapati",310,10,60,4.5,"piece:60|g:1",1,"indian","grain"],
  ["Butter Naan","naan|butter nan",320,8.5,52,9,"piece:90|g:1",1,"indian","grain"],
  ["Plain Naan","nan",290,8.5,54,4.5,"piece:85|g:1",1,"indian","grain"],
  ["Paratha (plain)","parantha|plain paratha",330,7,42,15,"piece:65|g:1",1,"indian","grain"],
  ["Aloo Paratha","potato paratha|alu paratha",280,6,38,11,"piece:110|g:1",1,"indian","grain"],
  ["Paneer Paratha","panner paratha",305,11,33,14,"piece:115|g:1",1,"indian","grain|protein"],
  ["Missi Roti","besan roti",300,11,50,6,"piece:55|g:1",1,"indian","grain"],
  ["Bajra Roti","pearl millet roti",320,11,58,5,"piece:50|g:1",1,"indian","grain|millet"],
  ["Jowar Roti","sorghum roti|bhakri",315,10,60,3.5,"piece:50|g:1",1,"indian","grain|millet"],
  ["Puri / Poori","poori|puri|fried puri",420,7,45,23,"piece:25|g:1",1,"indian","grain|fried"],
  ["Bhatura","bhature",380,8,48,17,"piece:80|g:1",1,"indian","grain|fried"],
  ["Kulcha","amritsari kulcha",300,8,52,6,"piece:80|g:1",1,"indian","grain"],
  ["Steamed Rice (cooked)","rice|white rice|chawal|boiled rice|plain rice|bhaat",130,2.7,28,0.3,"cup:158|katori:120|bowl:200|plate:250|g:1",1,"indian","grain|staple"],
  ["Brown Rice (cooked)","brown rice",123,2.6,26,1,"cup:158|katori:120|g:1",1,"indian","grain"],
  ["Jeera Rice","cumin rice",165,3,29,4,"cup:158|katori:120|g:1",1,"indian","grain"],
  ["Veg Pulao","pulao|pulav|vegetable pulao",180,4,30,5,"cup:180|katori:140|plate:300|g:1",1,"indian","grain|mixed"],
  ["Veg Biryani","biryani|vegetable biryani",190,4.5,29,6.5,"plate:300|cup:180|katori:150|g:1",1,"indian","grain|mixed"],
  ["Chicken Biryani","murgh biryani",210,10,26,7.5,"plate:330|cup:190|katori:160|g:1",0,"indian","grain|protein"],
  ["Mutton Biryani","gosht biryani",235,11,25,10,"plate:330|cup:190|g:1",0,"indian","grain|protein"],
  ["Curd Rice","dahi chawal|thayir sadam",125,3.5,20,3,"cup:200|katori:150|g:1",1,"indian","grain"],
  ["Lemon Rice","chitranna",170,3,29,5,"cup:180|katori:140|g:1",1,"indian","grain"],
  ["Khichdi","khichri|moong dal khichdi",120,4.5,19,2.5,"katori:180|cup:220|bowl:250|g:1",1,"indian","grain|mixed"],
  ["Poha","pohe|flattened rice cooked|kanda poha",145,2.5,25,4,"plate:180|cup:150|katori:120|g:1",1,"indian","breakfast"],
  ["Upma","uppuma|rava upma",160,3.5,24,5.5,"plate:180|cup:150|katori:120|g:1",1,"indian","breakfast"],
  ["Daliya (broken wheat porridge)","dalia|broken wheat",110,3.5,21,1.2,"katori:180|bowl:250|g:1",1,"indian","breakfast|grain"],
  ["Oats (cooked with water)","oatmeal|cooked oats",71,2.5,12,1.5,"bowl:240|cup:234|katori:180|g:1",1,"global","breakfast|grain"],
  ["Oats (dry, rolled)","oats|rolled oats|raw oats|oats dry",379,13,67,6.5,"cup:80|tbsp:10|scoop:40|g:1",1,"global","grain"],
  ["Muesli","museli",420,10,63,13,"cup:85|bowl:60|g:1",1,"global","breakfast"],
  ["Cornflakes (dry)","corn flakes",357,7,84,0.4,"cup:30|bowl:40|g:1",1,"global","breakfast"],

  // ---------- Dals, legumes & curries ----------
  ["Dal (toor/arhar, cooked tadka)","dal|daal|toor dal|arhar dal|tadka dal|yellow dal|dal fry",118,6,17,2.6,"katori:150|cup:240|bowl:250|g:1",1,"indian","legume|protein"],
  ["Dal Makhani","makhani dal|kali dal",190,7,18,10,"katori:150|cup:240|g:1",1,"indian","legume|protein"],
  ["Moong Dal (cooked)","mung dal|green gram dal",105,7,15,1.5,"katori:150|cup:240|g:1",1,"indian","legume|protein"],
  ["Masoor Dal (cooked)","red lentil dal",115,7,16,2,"katori:150|cup:240|g:1",1,"indian","legume|protein"],
  ["Chana Dal (cooked)","bengal gram dal",145,8,20,3.5,"katori:150|cup:240|g:1",1,"indian","legume|protein"],
  ["Rajma (kidney bean curry)","rajmah|kidney beans curry",135,7,19,3,"katori:150|cup:240|g:1",1,"indian","legume|protein"],
  ["Chole / Chana Masala","chhole|chickpea curry|chana masala|kabuli chana",165,7,22,5,"katori:150|cup:240|g:1",1,"indian","legume|protein"],
  ["Sambar","sambhar",85,4,11,2.5,"katori:150|cup:240|bowl:200|g:1",1,"indian","legume"],
  ["Rasam","charu",45,1.5,7,1.2,"katori:150|cup:240|g:1",1,"indian","soup"],
  ["Sprouts (moong, boiled)","sprouts|moong sprouts|boiled sprouts",100,8,15,0.6,"katori:100|cup:150|bowl:120|g:1",1,"indian","legume|protein"],
  ["Boiled Chickpeas","boiled chana|kabuli chana boiled",164,9,27,2.6,"katori:120|cup:160|g:1",1,"global","legume|protein"],
  ["Soya Chunks (cooked)","soy chunks|nutrela|meal maker",145,25,10,1,"katori:120|cup:150|g:1",1,"indian","protein"],

  // ---------- Paneer, eggs, meat, fish ----------
  ["Paneer","paneer|panner|cottage cheese|paneer cubes|raw paneer",296,18,1.2,25,"g:1|katori:100|cube:15",1,"indian","protein|dairy"],
  ["Paneer Bhurji","panner bhurji",245,15,6,18,"katori:150|cup:200|g:1",1,"indian","protein"],
  ["Palak Paneer","paneer palak|spinach paneer",180,9,7,13,"katori:150|cup:220|g:1",1,"indian","protein"],
  ["Shahi / Butter Paneer","paneer butter masala|shahi paneer|paneer makhani",240,10,10,18,"katori:150|cup:220|g:1",1,"indian","protein"],
  ["Grilled / Tandoori Paneer Tikka","paneer tikka",235,17,6,16,"piece:35|plate:200|g:1",1,"indian","protein"],
  ["Egg (whole, boiled)","boiled egg|anda|egg|eggs|hard boiled egg",155,13,1.1,11,"piece:50|g:1",0,"global","protein"],
  ["Egg White (boiled)","egg whites|boiled egg white",52,11,0.7,0.2,"piece:33|g:1",0,"global","protein"],
  ["Omelette (2 egg, oil)","omlet|omlette|omelet|egg omelette",190,12,2,15,"piece:120|g:1",0,"global","protein"],
  ["Egg Bhurji","anda bhurji|scrambled egg masala",205,12,4,16,"katori:130|plate:150|g:1",0,"indian","protein"],
  ["Chicken Breast (cooked, skinless)","chicken breast|grilled chicken|boiled chicken",165,31,0,3.6,"g:1|piece:120|katori:120",0,"global","protein"],
  ["Chicken Curry","chicken|chicken gravy|murgh curry|chicken masala",180,15,5,11,"katori:180|cup:240|plate:250|g:1",0,"indian","protein"],
  ["Butter Chicken","murgh makhani",235,15,7,17,"katori:180|cup:240|g:1",0,"indian","protein"],
  ["Chicken Tikka (tandoori)","tandoori chicken|chicken tikka|grilled chicken tikka",195,26,3,8.5,"piece:45|plate:200|g:1",0,"indian","protein"],
  ["Fried Chicken","kfc chicken|crispy chicken",290,20,12,18,"piece:90|g:1",0,"global","protein|fried"],
  ["Mutton Curry","lamb curry|gosht curry|mutton masala",235,17,4,17,"katori:180|cup:240|g:1",0,"indian","protein"],
  ["Fish Curry","machli curry|fish gravy",145,15,4,7.5,"katori:180|piece:80|g:1",0,"indian","protein"],
  ["Fish (grilled/tawa)","grilled fish|tawa fish|rohu|salmon",180,22,1,9,"piece:100|g:1",0,"global","protein"],
  ["Prawns (cooked)","shrimp|jhinga",120,22,1.5,2.5,"g:1|katori:100",0,"global","protein"],
  ["Whey Protein (scoop)","whey|whey protein|protein powder|protein shake powder",390,78,8,5,"scoop:30|g:1",1,"global","supplement|protein"],

  // ---------- Vegetables & sabzis ----------
  ["Mixed Veg Sabzi","sabzi|sabji|mix veg|vegetable curry",110,3,12,5.5,"katori:150|cup:200|g:1",1,"indian","vegetable"],
  ["Aloo Sabzi (potato curry)","aloo ki sabzi|potato sabzi",135,2.5,18,6,"katori:150|cup:200|g:1",1,"indian","vegetable"],
  ["Bhindi Masala","okra sabzi|lady finger sabzi",120,2.5,10,8,"katori:150|g:1",1,"indian","vegetable"],
  ["Baingan Bharta","brinjal bharta|eggplant bharta",105,2,9,7,"katori:150|g:1",1,"indian","vegetable"],
  ["Palak / Saag","spinach curry|saag|palak sabzi",95,4,7,5.5,"katori:150|g:1",1,"indian","vegetable"],
  ["Gobi Sabzi","cauliflower sabzi|aloo gobi",115,3,11,6.5,"katori:150|g:1",1,"indian","vegetable"],
  ["Lauki / Bottle Gourd Sabzi","lauki sabzi|ghiya",70,1.5,7,4,"katori:150|g:1",1,"indian","vegetable"],
  ["Green Salad (no dressing)","salad|kachumber|green salad",25,1.2,5,0.2,"plate:150|bowl:120|katori:100|g:1",1,"global","vegetable"],
  ["Cucumber","kheera",16,0.7,3.6,0.1,"piece:120|g:1",1,"global","vegetable"],
  ["Tomato","tamatar",18,0.9,3.9,0.2,"piece:100|g:1",1,"global","vegetable"],
  ["Onion","pyaz",40,1.1,9.3,0.1,"piece:110|g:1",1,"global","vegetable"],
  ["Carrot","gajar",41,0.9,10,0.2,"piece:60|cup:128|g:1",1,"global","vegetable"],
  ["Boiled Potato","aloo|potato",87,1.9,20,0.1,"piece:135|cup:150|g:1",1,"global","vegetable"],
  ["Broccoli (cooked)","brocoli",35,2.4,7,0.4,"cup:156|katori:100|g:1",1,"global","vegetable"],
  ["Sweet Potato (boiled)","shakarkandi",86,1.6,20,0.1,"piece:130|cup:200|g:1",1,"global","vegetable"],
  ["Corn (boiled)","bhutta|sweet corn",96,3.4,21,1.5,"cup:165|piece:90|g:1",1,"global","vegetable"],

  // ---------- Dairy ----------
  ["Milk (full cream)","doodh|whole milk|full cream milk",67,3.3,5,3.9,"glass:250|cup:240|ml:1",1,"global","dairy"],
  ["Milk (toned)","toned milk|milk",58,3.2,4.8,3,"glass:250|cup:240|ml:1",1,"global","dairy"],
  ["Milk (skimmed)","skim milk|double toned milk",35,3.4,5,0.1,"glass:250|cup:240|ml:1",1,"global","dairy"],
  ["Curd / Dahi (full fat)","curd|dahi|yogurt|yoghurt",98,4,4.7,7,"katori:150|cup:245|bowl:200|g:1",1,"indian","dairy|protein"],
  ["Greek Yogurt (plain)","greek yoghurt|hung curd",97,9,4,4,"cup:200|katori:150|g:1",1,"global","dairy|protein"],
  ["Buttermilk / Chaas","chaas|chhachh|buttermilk|mattha",35,1.7,3.5,1.3,"glass:250|ml:1",1,"indian","dairy"],
  ["Lassi (sweet)","sweet lassi",115,3,17,4,"glass:250|ml:1",1,"indian","dairy|drink"],
  ["Butter","makkhan|amul butter",717,0.9,0.1,81,"tsp:5|tbsp:14|g:1",1,"global","fat"],
  ["Ghee","clarified butter|desi ghee",900,0,0,100,"tsp:5|tbsp:14|g:1",1,"indian","fat"],
  ["Cheese Slice","cheese|processed cheese",340,20,5,27,"slice:20|g:1",1,"global","dairy"],
  ["Cream / Malai","fresh cream|malai",300,2,3,31,"tbsp:15|g:1",1,"global","fat"],

  // ---------- South Indian ----------
  ["Idli","idly",135,3.5,28,0.5,"piece:45|g:1",1,"indian","breakfast"],
  ["Plain Dosa","dosa|sada dosa",190,4,29,6,"piece:110|g:1",1,"indian","breakfast"],
  ["Masala Dosa","masala dose",205,4.5,30,7.5,"piece:180|g:1",1,"indian","breakfast"],
  ["Uttapam","uthappam",175,4,27,5.5,"piece:130|g:1",1,"indian","breakfast"],
  ["Medu Vada","vada|medu vada",290,6,32,15,"piece:50|g:1",1,"indian","snack|fried"],
  ["Coconut Chutney","chutney|nariyal chutney",130,2.5,6,11,"tbsp:20|katori:50|g:1",1,"indian","condiment"],
  ["Appam","aappam",145,2.5,28,2.5,"piece:80|g:1",1,"indian","breakfast"],

  // ---------- Snacks & street food ----------
  ["Samosa","samosas",300,5,32,17,"piece:60|g:1",1,"indian","snack|fried"],
  ["Pakora / Bhajiya","pakoda|bhajji|fritters|onion pakora",315,7,28,19,"piece:25|plate:100|g:1",1,"indian","snack|fried"],
  ["Vada Pav","vada pao",290,7,40,11,"piece:150|g:1",1,"indian","snack"],
  ["Pav Bhaji","pav bhaaji",195,4.5,25,8.5,"plate:300|g:1",1,"indian","snack"],
  ["Pani Puri / Golgappa","golgappa|puchka|panipuri",110,2,17,4,"piece:20|plate:120|g:1",1,"indian","snack"],
  ["Bhel Puri","bhelpuri",240,5,38,7.5,"plate:120|katori:80|g:1",1,"indian","snack"],
  ["Chole Bhature (plate)","chola bhatura",270,7,34,12,"plate:350|g:1",1,"indian","meal"],
  ["Momos (steamed veg)","momo|dumplings",180,5,28,5,"piece:25|plate:150|g:1",1,"asian","snack"],
  ["Spring Roll","spring rolls",250,5,32,11,"piece:60|g:1",1,"asian","snack|fried"],
  ["Sandwich (veg, grilled)","veg sandwich|grilled sandwich|sandwich",240,7,30,10,"piece:150|g:1",1,"global","snack"],
  ["Bread (white)","white bread|bread slice|bread",265,9,49,3.2,"slice:28|g:1",1,"global","grain"],
  ["Brown Bread","whole wheat bread|multigrain bread",250,10,44,3.5,"slice:30|g:1",1,"global","grain"],
  ["Rusk / Toast","rusk|toast",400,9,72,8,"piece:15|g:1",1,"indian","snack"],
  ["Biscuit (marie / digestive)","biscuit|biscuits|marie|parle g|cookie|cookies",450,7,72,14,"piece:8|packet:75|g:1",1,"global","snack"],
  ["Namkeen / Mixture","namkeen|sev|mixture|bhujia",520,12,50,30,"handful:25|packet:50|g:1",1,"indian","snack|fried"],
  ["Potato Chips","chips|lays|wafers",540,6,53,34,"packet:30|handful:25|g:1",1,"global","snack|fried"],
  ["Popcorn (plain)","popcorn",380,12,74,4.5,"bowl:30|cup:8|g:1",1,"global","snack"],
  ["Maggi / Instant Noodles","maggi|noodles|instant noodles|ramen",440,9,60,18,"packet:70|plate:150|bowl:200|g:1",1,"global","snack"],
  ["Peanuts (roasted)","moongphali|groundnut|peanut",567,26,16,49,"handful:28|katori:60|tbsp:12|g:1",1,"global","nuts|protein"],
  ["Almonds","badam|almond",579,21,22,50,"piece:1.2|handful:28|g:1",1,"global","nuts"],
  ["Cashews","kaju|cashew",553,18,30,44,"piece:1.5|handful:28|g:1",1,"global","nuts"],
  ["Walnuts","akhrot|walnut",654,15,14,65,"piece:4|handful:28|g:1",1,"global","nuts"],
  ["Peanut Butter","pb|peanut butter",588,25,20,50,"tbsp:16|tsp:6|g:1",1,"global","nuts|fat"],
  ["Makhana (roasted foxnut)","foxnut|lotus seeds|makhana",350,9.7,77,0.1,"katori:20|handful:15|g:1",1,"indian","snack"],
  ["Chia Seeds","chia",486,17,42,31,"tbsp:12|tsp:4|g:1",1,"global","seeds"],
  ["Protein Bar","energy bar|protein bar",380,25,40,10,"piece:60|g:1",1,"global","supplement"],

  // ---------- Global mains ----------
  ["Pizza (cheese, medium slice)","pizza|cheese pizza",270,11,30,11,"slice:110|piece:110|g:1",1,"global","meal"],
  ["Burger (veg)","veg burger|aloo tikki burger",250,7,33,10,"piece:160|g:1",1,"global","meal"],
  ["Burger (chicken)","chicken burger",280,14,29,12,"piece:170|g:1",0,"global","meal"],
  ["Pasta (white sauce)","white sauce pasta|creamy pasta",210,6,25,10,"plate:250|cup:180|g:1",1,"global","meal"],
  ["Pasta (red sauce)","red sauce pasta|arrabiata|pasta",165,5.5,27,4,"plate:250|cup:180|g:1",1,"global","meal"],
  ["Fried Rice (veg)","veg fried rice|fried rice",180,4,28,6,"plate:280|cup:180|g:1",1,"asian","meal"],
  ["Hakka Noodles (veg)","chowmein|chow mein|hakka noodles|veg noodles",190,5,29,6.5,"plate:250|cup:180|g:1",1,"asian","meal"],
  ["Manchurian (veg, gravy)","veg manchurian|manchurian",190,4,22,10,"katori:150|plate:200|g:1",1,"asian","snack"],
  ["French Fries","fries|finger chips",312,3.4,41,15,"plate:120|packet:100|g:1",1,"global","snack|fried"],
  ["Chicken Shawarma / Roll","shawarma|chicken roll|kathi roll",250,13,26,11,"piece:200|g:1",0,"global","meal"],
  ["Veg Roll / Frankie","frankie|veg roll|kathi roll veg",235,6,32,9,"piece:180|g:1",1,"indian","meal"],
  ["Poha/Upma Plate (canteen)","canteen breakfast",155,3.5,25,4.5,"plate:200|g:1",1,"indian","breakfast"],
  ["Thali (veg, restaurant)","veg thali|thali",165,6,22,6,"plate:600|g:1",1,"indian","meal"],
  ["Thali (non-veg)","non veg thali|chicken thali",190,10,21,8,"plate:600|g:1",0,"indian","meal"],

  // ---------- Sweets & desserts ----------
  ["Sugar","cheeni|shakkar|sugar",387,0,100,0,"tsp:5|tbsp:12|g:1",1,"global","sweet"],
  ["Honey","shahad",304,0.3,82,0,"tsp:7|tbsp:21|g:1",1,"global","sweet"],
  ["Jaggery","gud|gur",383,0.4,97,0.1,"piece:10|tsp:5|g:1",1,"indian","sweet"],
  ["Gulab Jamun","gulabjamun",320,4,45,14,"piece:40|g:1",1,"indian","sweet"],
  ["Rasgulla","rosogolla|rasgulla",186,4,38,1.5,"piece:45|g:1",1,"indian","sweet"],
  ["Jalebi","jalebee",390,2,68,12,"piece:25|g:1",1,"indian","sweet|fried"],
  ["Laddu (besan)","ladoo|laddoo|besan ladoo",425,7,52,21,"piece:40|g:1",1,"indian","sweet"],
  ["Barfi","burfi|kaju katli",420,8,52,20,"piece:25|g:1",1,"indian","sweet"],
  ["Halwa (suji)","sooji halwa|halwa|gajar halwa",340,4,45,16,"katori:100|bowl:150|g:1",1,"indian","sweet"],
  ["Kheer","payasam|rice kheer",145,3.5,22,4.5,"katori:150|bowl:200|g:1",1,"indian","sweet"],
  ["Ice Cream (vanilla)","icecream|ice cream",207,3.5,24,11,"scoop:60|cup:130|g:1",1,"global","sweet"],
  ["Chocolate (milk)","dairy milk|chocolate",535,7.6,59,30,"piece:12|bar:40|g:1",1,"global","sweet"],
  ["Cake (sponge slice)","cake|pastry",370,5,50,17,"slice:80|piece:80|g:1",1,"global","sweet"],
  ["Donut","doughnut",420,5,51,22,"piece:60|g:1",1,"global","sweet"],

  // ---------- Fruits ----------
  ["Banana","kela|banana",89,1.1,23,0.3,"piece:118|g:1",1,"global","fruit"],
  ["Apple","seb|apple",52,0.3,14,0.2,"piece:180|g:1",1,"global","fruit"],
  ["Orange","santra|orange",47,0.9,12,0.1,"piece:150|g:1",1,"global","fruit"],
  ["Mango","aam|mango",60,0.8,15,0.4,"piece:200|cup:165|g:1",1,"global","fruit"],
  ["Papaya","papita",43,0.5,11,0.3,"cup:145|katori:120|g:1",1,"global","fruit"],
  ["Watermelon","tarbooj",30,0.6,8,0.2,"cup:152|slice:280|g:1",1,"global","fruit"],
  ["Grapes","angoor",69,0.7,18,0.2,"cup:151|handful:40|g:1",1,"global","fruit"],
  ["Pomegranate","anar",83,1.7,19,1.2,"cup:174|piece:180|g:1",1,"global","fruit"],
  ["Guava","amrud",68,2.6,14,0.9,"piece:120|g:1",1,"global","fruit"],
  ["Dates","khajoor|date",282,2.5,75,0.4,"piece:8|handful:40|g:1",1,"global","fruit"],
  ["Mixed Fruit Bowl","fruit bowl|fruit salad|fruits",60,0.8,15,0.3,"bowl:200|katori:150|g:1",1,"global","fruit"],

  // ---------- Drinks ----------
  ["Tea with milk & sugar","chai|tea|milk tea|masala chai",65,1.5,9,2.4,"cup:150|glass:200|ml:1",1,"indian","drink"],
  ["Tea without sugar","chai without sugar|sugarless tea",35,1.5,3,2,"cup:150|ml:1",1,"indian","drink"],
  ["Green Tea","greentea",1,0,0.2,0,"cup:200|ml:1",1,"global","drink"],
  ["Black Coffee","coffee black|americano",2,0.1,0.3,0,"cup:240|ml:1",1,"global","drink"],
  ["Coffee with milk & sugar","coffee|milk coffee|latte|cappuccino",60,2,8,2.2,"cup:180|glass:250|ml:1",1,"global","drink"],
  ["Cold Coffee","cold coffee|frappe",110,3,16,4,"glass:300|ml:1",1,"global","drink"],
  ["Soft Drink (cola)","coke|pepsi|cola|soft drink|soda",42,0,10.6,0,"glass:250|can:330|bottle:500|ml:1",1,"global","drink"],
  ["Fruit Juice (packaged)","juice|orange juice|packaged juice",48,0.3,11.5,0.1,"glass:250|bottle:200|ml:1",1,"global","drink"],
  ["Fresh Lime Soda (sweet)","nimbu pani|lemonade|shikanji",38,0.1,9.5,0,"glass:250|ml:1",1,"indian","drink"],
  ["Beer","beer",43,0.5,3.6,0,"bottle:650|can:330|glass:250|ml:1",1,"global","alcohol"],
  ["Whisky / Rum / Vodka (spirit)","whisky|whiskey|rum|vodka|gin",250,0,0,0,"peg:30|ml:1",1,"global","alcohol"],
  ["Wine","red wine|white wine",83,0.1,2.6,0,"glass:150|ml:1",1,"global","alcohol"],
  ["Water","paani|water",0,0,0,0,"glass:250|bottle:1000|ml:1",1,"global","drink"],
  ["Protein Shake (whey + milk)","protein shake",85,10,6,2.2,"glass:300|ml:1",1,"global","supplement"],
  ["Coconut Water","nariyal pani",19,0.7,3.7,0.2,"glass:250|piece:300|ml:1",1,"global","drink"],

  // ---------- Oils & extras ----------
  ["Cooking Oil","oil|refined oil|sunflower oil|mustard oil|olive oil",884,0,0,100,"tsp:5|tbsp:14|ml:1",1,"global","fat"],
  ["Mayonnaise","mayo",680,1,2,75,"tbsp:15|tsp:5|g:1",1,"global","fat"],
  ["Tomato Ketchup","ketchup|sauce|tomato sauce",100,1,25,0.1,"tbsp:17|tsp:6|g:1",1,"global","condiment"],
  ["Pickle (achar)","achar|pickle",250,1,10,22,"tsp:8|tbsp:20|g:1",1,"indian","condiment"],
  ["Papad (roasted)","papadum|papad",320,20,50,3,"piece:12|g:1",1,"indian","snack"],
  ["Raita","boondi raita|cucumber raita",65,3,5,3.5,"katori:120|cup:200|g:1",1,"indian","dairy"]
];

export const SEED_FOODS: SeedFood[] = (ROWS as Row[]).map(
  ([name, aliases, kcal, protein, carbs, fat, units, veg, cuisine, tags]) => ({
    name,
    aliases: aliases ? aliases.split("|").filter(Boolean) : [],
    kcal,
    protein,
    carbs,
    fat,
    units: units.split("|").map((u) => {
      const [unitName, grams] = u.split(":");
      return { name: unitName, grams: Number(grams) };
    }),
    veg: Boolean(veg),
    cuisine,
    tags: tags ? tags.split("|").filter(Boolean) : [],
  })
);
