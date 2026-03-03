import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log(supabaseUrl, supabaseAnonKey)

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getMeta = async(image_id) => {
	let { data, error } = await supabase
    .from('menu_definitions_with_uuid_3')
    .select('*')
    .eq('image_id', image_id);


	if (error) {
		console.error(error)
		return
	} else {
		console.log(data)
	}
	return data
}

export const countFaves = async () => {
	try {
		const { data, error } = await supabase.rpc('courts_calc')
		if (error) {
		  throw error;
		}	
		return data;
	  } catch (error) {
		console.error('Error fetching map counts:', error);
	  }	
}

export const countRows = async (criteria) => {
    // Replace 'your_table' with the name of your table
    let { count, error } = await supabase
      .from('courts_faves')
      .select('*', { count: 'exact' })
      .eq('court_id', criteria) // Filtering where court_id equals 10
    
    if (error) {
      console.error(error)
      return
    }
  
    console.log('Row Count:', count)
    return count
}
