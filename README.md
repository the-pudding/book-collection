decide on images for soot:
- try removing germany...or maybe just one's with a geography?
- remove anything less than 1960s
- remove anything that doesn't have high-res
- could also just do first page of menu with menu content (so less repeating?)
- remove wines



missing related images from image download!!! only need for the 7500 i use though...

need to still get waldorf other other famous restaurants...Ritz-Carlton

# analyze-menu-content.js -> creates one line summary of the menu for modal
# running on all menus with dishes
outputs to menu-content-analysis.json


# create the neccessary content for the metadata file...

# match_metadata.js looks at all eligable image_ids and gets corresponding menu-ids and the location/geo about them, aggregated into one array, which outputs to assocated_menu_info.json.

#
-- the following all ouputs to -> restaurant-info-analysis.json --
#

# get structured title data for restaurants
analyze-restaurant-info.js
# parse location data to city and state for auto complete
analyze-restaurant-geo.js

# update metadata csv file for upload to soot
update-metadata-from-analysis.js
update-metadata-from-menu-years.js

#
--
#

## these two will get pushed to a seperate json file that doesn't need to go to soot.
# analyze-menu-fanciness.js 
outputs to menu-fanciness-analysis.json

# analyze-menu-familiarity.js 
outputs to menu-familiarity-analysis.json

# get animals by dish -> analyze-animal-content.js -> Dish_Animal_Analysis.csv
# and then aggregate-animals-by-menu-page.js -> menu-page-animals.json

# this needs to get parsed to include rare animals and also the icons so that it appears in soot.
update-metadata-from-familiarity.js -> updates metadata with familiarity score

# create output file for modal window. aggregate-menu-analysis.js
outputs to processed_data/menu-aggregated-analysis.json ... note that each image_id goes to multiple menu_ids, so we'll need to pick a menu_id to use.




popular restaurants
city
familairty score - with present day
luxury score - based how high end
rare animals
organs / offal
animal filter - analyze-animal-content.js

Alligator Pear
cheeses? what cheeses?
- italian cheeses
vegatables
style of potatoes
dessert trends?

tags will need to be in a menupage level since that's what the filters are




