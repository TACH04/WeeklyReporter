import unittest
import pandas as pd
import numpy as np
import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_sync import detect_column_mapping

class TestExcelParsing(unittest.TestCase):
    def test_detect_mapping_with_headers(self):
        # Create a sample dataframe with standard headers
        df = pd.DataFrame({
            0: ["EmpID", "1234567890", "9876543210"],
            1: ["Last Name", "Smith", "Doe"],
            2: ["First Name", "John", "Jane"],
            3: ["Email", "john.smith@asu.edu", "jane.doe@asu.edu"],
            4: ["Room", "CERA-0101", "CERA-0102"],
            5: [np.nan, True, False],
            6: ["Interaction 1", "John was great.", "Jane is fine."],
            7: [np.nan, False, True],
            8: ["Interaction 2", "Talked to John again.", ""]
        })
        
        mapping, header_row = detect_column_mapping(df)
        self.assertEqual(header_row, 0)
        self.assertEqual(mapping['asu_id'], 0)
        self.assertEqual(mapping['last_name'], 1)
        self.assertEqual(mapping['first_name'], 2)
        self.assertEqual(mapping['email'], 3)
        self.assertEqual(mapping['room'], 4)
        self.assertIn(6, mapping['interactions'])
        self.assertIn(8, mapping['interactions'])

    def test_detect_mapping_shifted_headers(self):
        # Headers on row 2 (index 2)
        df = pd.DataFrame({
            0: [np.nan, "Title", "EmpID", "1234567890", "9876543210"],
            1: [np.nan, "Misc", "Surname", "Smith", "Doe"],
            2: [np.nan, "Misc", "Given Name", "John", "Jane"],
            3: [np.nan, "Misc", "Email", "john.smith@asu.edu", "jane.doe@asu.edu"],
            4: [np.nan, "Misc", "Room", "CERA-0101", "CERA-0102"],
            5: [np.nan, "Misc", "Notes 1", "John was great.", "Jane is fine."]
        })
        
        mapping, header_row = detect_column_mapping(df)
        self.assertEqual(header_row, 2)
        self.assertEqual(mapping['asu_id'], 0)
        self.assertEqual(mapping['last_name'], 1)
        self.assertEqual(mapping['first_name'], 2)
        self.assertEqual(mapping['email'], 3)
        self.assertEqual(mapping['room'], 4)
        self.assertIn(5, mapping['interactions'])

    def test_detect_mapping_headerless(self):
        # Headerless dataframe, relying on data sniffing
        df = pd.DataFrame({
            0: ["1234567890.0", "9876543210.0", "1112223334"], # ID with floats
            1: ["Smith", "Doe", "Zuckerberg"],
            2: ["John", "Jane", "Mark"],
            3: ["john.smith@asu.edu", "jane.doe@asu.edu", "mark@asu.edu"],
            4: ["CERA-0101", "CERA-0102", "CERA-0103"],
            5: ["John talked to me about his classes today and it was a very long conversation about physics.", 
                "Jane mentioned she is going home for the weekend next week.", 
                "Mark is building a social network in his dorm room right now."]
        })
        
        mapping, header_row = detect_column_mapping(df)
        self.assertIsNone(header_row)
        self.assertEqual(mapping['asu_id'], 0)
        self.assertEqual(mapping['email'], 3)
        self.assertEqual(mapping['room'], 4)
        self.assertIn(5, mapping['interactions'])

if __name__ == '__main__':
    unittest.main()
