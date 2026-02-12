make sure metadata filters work correctly for squirrel and rare.
make sure random buttons work and correct modal.



add other metadata...squrill...
finish images for tour

* put static images for loading screen in compressed format and local to repo



FOR TOUR

key menus (tag)
 - norway, etc.

 abundance (tag)

- create new dataset that includes ships, change to only go to 1924.
- 

*****need to analyze menu items for each page. create list of related image ids map -- pull image items using existing csv...this will be a map of items to the parent image_id...run anakysis and explanatino on that..

run fanciness anlaysis, trying to get it to define items.
run familiarity anlaysis: trying to get to define items.

offensive things??
but what if that's the point...like chinese food that's old? or takes on other culture's food? like italian? first mention of pizza? or collactions--where became more popular as a luxury item...like lobster?

# mapping of image_id to other image_ids
menu-page-aggregated-ids.json

# create file of images to remove after a certain date
scripts/filter-by-date.js

**CREATE CONTENT FOR MODAL**
# analyze-menu-content.js -> creates one line summary of the menu for modal
# running on all menus with dishes
outputs to menu-content-analysis.json

SO TO BUILD-FINAL-IMAGES-LIST.JS

filtered_for_items.csv -> this file has image_ids and uuids of only images that have crownsourced data

TODO: breakdown-menu-by-location.js -> menus-by-location.json -> extract-first-menu-id-per-group.js -> first-menu-id-per-group.json this is not working correctly to allow only one menu per year restaurant. this is removed from the build-final-images-list.js


[only needs to be run once] extract-first-page-images.js -> first-page-images.csv - this is working. creates a json object menu-pages-map.json that is menu_id: array of [image_id, page_number]. this only includes pages with items and excludes anything that's primarily wine. this allows to surface only the first page for a menu_id.



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
update-metadata-from-animals.js

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




