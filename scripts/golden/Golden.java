package Ponomar;

import java.io.*;

// Headless harness: dumps upstream results as CSV golden fixtures. Not part of the published package.
public class Golden
{
	public static void main(String[] args) throws Exception
	{
		String mode = args[0];
		int stride = Integer.parseInt(args[2]);
		try (PrintWriter out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(new FileOutputStream(args[1]), "UTF-8"))))
		{
			switch (mode)
			{
				case "jdate": jdate(out, stride); break;
				case "pascha": pascha(out); break;
				case "pcalendar": pcalendar(out, stride); break;
				case "dsl": dsl(out); break;
				case "day": day(out, stride, args[3]); break;
				case "fastconvert": fastconvert(out); break;
				case "liturgy": liturgy(out, stride, args[3], false); break;
				case "matins": liturgy(out, stride, args[3], true); break;
				case "lives": lives(out, args[3]); break;
				case "numbers": numbers(out); break;
				case "hours": hours(out, stride, args[3]); break;
				case "royal": royal(out, args[3]); break;
				case "sun": sun(out, stride, args[3]); break;
				case "suntime": suntime(out, stride, args[3]); break;
				case "moon": moon(out, stride, args[3]); break;
				case "texts": texts(out, args[3]); break;
				default: throw new IllegalArgumentException(mode);
			}
		}
	}

	// Fasting.convert for every 7-digit level in several languages. Run with cwd = vendor/ponomar.
	private static void fastconvert(PrintWriter out)
	{
		out.println("language\tlevel\ttext");
		for (String language : new String[] { "en/", "fr/", "cu/ru/", "el/mono/", "zh/Hans/", "zh/Hant/" })
		{
			OrderedHashtable info = new OrderedHashtable();
			info.put("LS", language);
			Fasting fasting = new Fasting(info);
			for (int n = 0; n < 128; n++)
			{
				String level = String.format("%7s", Integer.toBinaryString(n)).replace(' ', '0');
				String text;
				try
				{
					text = fasting.convert(level);
				}
				catch (Throwable t)
				{
					text = "ERR";
				}
				out.println(language + "\t" + level + "\t" + String.valueOf(text).replace('\t', ' ').replace('\n', ' '));
			}
		}
	}

	// Hands DivineLiturgy1.Readings' result to the harness instead of formatting it with the Swing Bible window.
	static class CaptureLiturgy extends DivineLiturgy1
	{
		java.util.Vector readings, ranks, tags;

		CaptureLiturgy(OrderedHashtable info)
		{
			super(info);
		}

		@Override
		public String format(java.util.Vector vectV, java.util.Vector vectR, java.util.Vector vectT)
		{
			readings = vectV;
			ranks = vectR;
			tags = vectT;
			return "";
		}

		String captured()
		{
			StringBuilder text = new StringBuilder();
			for (int i = 0; i < readings.size(); i++)
			{
				if (i > 0)
				{
					text.append('|');
				}
				text.append(readings.get(i)).append('~').append(ranks.get(i)).append('~').append(tags.get(i));
			}
			return text.toString();
		}
	}

	// As CaptureLiturgy, for Matins.Readings.
	static class CaptureMatins extends Matins
	{
		java.util.Vector readings, ranks, tags;

		CaptureMatins(OrderedHashtable info)
		{
			super(info);
		}

		@Override
		public String format(java.util.Vector vectV, java.util.Vector vectR, java.util.Vector vectT)
		{
			readings = vectV;
			ranks = vectR;
			tags = vectT;
			return "";
		}

		String captured()
		{
			StringBuilder text = new StringBuilder();
			for (int i = 0; i < readings.size(); i++)
			{
				if (i > 0)
				{
					text.append('|');
				}
				text.append(readings.get(i)).append('~').append(ranks.get(i)).append('~').append(tags.get(i));
			}
			return text.toString();
		}
	}

	// The Liturgy (or Matins) readings Main.write() would show, as reading~rank~tag items. The tag of a commemoration's own
	// reading is its CId here (upstream uses its localized name); transferred sequential readings carry a weekday.
	private static void liturgy(PrintWriter out, int stride, String yearList, boolean matins) throws Exception
	{
		String[] languages = { "en/", "cu/ru/", "el/mono/", "fr/", "zh/Hans/", "zh/Hant/" };
		java.lang.reflect.Field field = Day.class.getDeclaredField("OrderedCommemorations");
		field.setAccessible(true);
		String section = matins ? "MATINS" : "LITURGY";
		String[] types = matins ? new String[] { "matins" } : new String[] { "apostol", "gospel" };
		out.println(String.join("\t", "language", "gs", "year", "month", "day", matins ? "matins" : "apostol\tgospel"));
		for (String language : languages)
		{
			for (int gs = 0; gs <= 1; gs++)
			{
				for (String yearText : yearList.split(","))
				{
					int year = Integer.parseInt(yearText);
					JDate pascha = Paschalion.getPascha(year);
					JDate previous = Paschalion.getPascha(year - 1);
					JDate next = Paschalion.getPascha(year + 1);
					long first = new JDate(1, 1, year).getJulianDay();
					long last = new JDate(12, 31, year).getJulianDay();
					for (long j = first; j <= last; j += stride)
					{
						JDate today = new JDate(j);
						int nday = (int) JDate.difference(today, pascha);
						int ndayP = (int) JDate.difference(today, previous);
						OrderedHashtable info = new OrderedHashtable();
						info.put("dow", today.getDayOfWeek());
						info.put("doy", today.getDoy());
						info.put("nday", nday);
						info.put("ndayP", ndayP);
						info.put("ndayF", (int) JDate.difference(today, next));
						info.put("GS", gs);
						info.put("LS", language);
						info.put("Year", today.getYear());
						info.put("dRank", 0);
						info.put("Ideographic", "0");
						info.put("ReadSep", "; ");

						String folder = nday >= -70 && nday < 0 ? "xml/triodion/" : "xml/pentecostarion/";
						int line = nday >= -70 && nday < 0 ? Math.abs(nday) : (nday < -70 ? ndayP + 1 : nday + 1);
						int m = today.getMonth();
						int d = today.getDay();
						Day paschal = new Day(folder + (line >= 10 ? Integer.toString(line) : "0" + line), info);
						Day menaion = new Day("xml/" + (m < 10 ? "0" + m : "" + m) + (d < 10 ? "/0" + d : "/" + d), info);
						java.util.Vector entries = new java.util.Vector();
						try
						{
							info.put("dRank", Math.max(menaion.getDayRank(), paschal.getDayRank()));

							// As Main: the menaion's commemorations first, then the Triodion or Pentecostarion's.
							for (Day part : new Day[] { menaion, paschal })
							{
								for (Object item : (java.util.Vector) field.get(part))
								{
									Commemoration1 c = (Commemoration1) item;
									Object table = c.getReadings().get(section);
									if (table != null)
									{
										entries.add(new Object[] { table, Integer.valueOf(c.getRank()), c.getCId() });
									}
								}
							}
						}
						catch (NumberFormatException failure)
						{
							// fr/xml/05/03.xml names the commemoration "050307;", which Commemoration1.getRank cannot parse.
							System.err.println("SKIP " + language + year + "-" + m + "-" + d + " gs" + gs + ": " + failure.getMessage());
							continue;
						}
						String[] results = new String[types.length];
						for (int t = 0; t < types.length; t++)
						{
							try
							{
								java.util.Vector readings = new java.util.Vector();
								java.util.Vector ranks = new java.util.Vector();
								java.util.Vector tags = new java.util.Vector();
								for (Object entry : entries)
								{
									Object[] e = (Object[]) entry;
									OrderedHashtable step = (OrderedHashtable) ((OrderedHashtable) e[0]).get(types[t]);
									if (matins && step == null)
									{
										step = (OrderedHashtable) ((OrderedHashtable) e[0]).get("1");
									}
									readings.add(step != null ? step.get("Reading").toString() : "");
									ranks.add(e[1]);
									tags.add(e[2]);
								}
								// Main shows a Liturgy type only when the first commemoration has it; Matins whenever any has the section.
								if (readings.isEmpty() || (!matins && readings.get(0).equals("")))
								{
									results[t] = "-";
									continue;
								}
								OrderedHashtable readingsA = new OrderedHashtable();
								readingsA.put("Readings", readings);
								readingsA.put("Rank", ranks);
								readingsA.put("Tag", tags);
								if (matins)
								{
									CaptureMatins capture = new CaptureMatins(info);
									capture.Readings(readingsA, today);
									results[t] = capture.captured();
								}
								else
								{
									CaptureLiturgy capture = new CaptureLiturgy(info);
									capture.Readings(readingsA, types[t], today);
									results[t] = capture.captured();
								}
							}
							catch (Throwable error)
							{
								results[t] = "ERR";
							}
						}
						out.println(String.join("\t", language, "" + gs, "" + year, "" + m, "" + d, String.join("\t", results)));
					}
				}
			}
		}
	}

	// Length and hash of the trimmed text, so long texts compare without being stored.
	private static String fingerprint(String text)
	{
		String trimmed = text.trim();
		return trimmed.length() + ":" + Integer.toHexString(trimmed.hashCode());
	}

	private static String clean(String text)
	{
		return text.replace('\t', ' ').replace('\n', ' ').replace('\r', ' ');
	}

	// Records the directives of a service template whose condition holds, as normalized lines, then lets Service handle them.
	// Bible passages and proper texts are not handed on: the port carries no Bible text, and upstream's null pointer on a missing
	// proper would end the rest of that include, where the port keeps going.
	static class TraceService extends Service
	{
		final java.util.List<String> trace = new java.util.ArrayList<String>();
		private final StringOp condition = new StringOp();
		private final OrderedHashtable info;

		TraceService(OrderedHashtable info)
		{
			super(info);
			this.info = info;
			condition.dayInfo = info;
		}

		private static String flag(Object value)
		{
			return "1".equals(value) ? "1" : "0";
		}

		private static String value(Object value)
		{
			return value == null ? "-" : clean(value.toString());
		}

		private String text(Object name)
		{
			if (name == null)
			{
				return "-";
			}
			String text = new ReadText((OrderedHashtable) info.clone()).readText("xml/Services/Text/" + name + ".xml");
			return text == null || text.length() == 0 ? "-" : fingerprint(text);
		}

		private String properText(java.util.Hashtable table)
		{
			// The text and header GETID finds in the commemoration's service data, as Service does (it drops the text's first character).
			String id = table.get("Id").toString();
			if ("T".equals(table.get("Type")))
			{
				id = "98" + id;
			}
			String what = table.get("What").toString();
			int slash = what.lastIndexOf("/");
			OrderedHashtable item = new Commemoration1("0", id, info).getService(what.substring(0, slash), what.substring(slash + 1));
			if (item == null || item.get("text") == null || item.get("text").toString().length() == 0)
			{
				return "-|-";
			}
			Object header = item.get("Header");
			return fingerprint(item.get("text").toString().substring(1)) + "|" + (header == null ? "-" : clean(header.toString()));
		}

		@Override
		public void startElement(String elem, java.util.Hashtable table)
		{
			Object cmd = table.get("Cmd");
			if (cmd != null && !condition.evalbool(cmd.toString()))
			{
				super.startElement(elem, table);
				return;
			}
			String line = null;
			switch (elem)
			{
				case "TITLE":
					line = "title|" + text(table.get("Value")) + "|" + text(table.get("Header")) + "|" + text(table.get("Source")) + "|" + text(table.get("Comment"));
					break;
				case "SUBTITLE":
					line = "subtitle|" + text(table.get("Value"));
					break;
				case "CREATE":
					line = "prayer|" + value(table.get("What")) + "|" + value(table.get("Who")) + "|" + flag(table.get("RedFirst")) + "|" + flag(table.get("NewLine")) + "|" + flag(table.get("Header")) + "|" + value(table.get("Times")) + "|" + value(table.get("Command")) + "|" + value(table.get("CommandB"));
					break;
				case "BIBLE":
					line = "reading|" + value(table.get("Verses")) + "|" + value(table.get("getReading")) + "|" + value(table.get("Who")) + "|" + flag(table.get("RedFirst")) + "|" + flag(table.get("NewLine")) + "|" + flag(table.get("Header")) + "|" + value(table.get("2Stars"));
					break;
				case "GETID":
					line = "proper|" + (table.get("Type") == null ? "M" : value(table.get("Type"))) + "|" + value(table.get("Id")) + "|" + value(table.get("What")) + "|" + value(table.get("Who")) + "|" + flag(table.get("RedFirst")) + "|" + flag(table.get("NewLine")) + "|" + flag(table.get("Header")) + "|" + properText(table);
					break;
				default:
					break;
			}
			if (line != null)
			{
				trace.add(line);
			}
			if (!elem.equals("BIBLE") && !elem.equals("GETID"))
			{
				super.startElement(elem, table);
			}
		}
	}

	// The text and header ReadText finds for each service file name (one per line in the given file) in every language.
	// Run with cwd = vendor/ponomar.
	private static void texts(PrintWriter out, String keysFile) throws Exception
	{
		java.util.List<String> keys = java.nio.file.Files.readAllLines(java.nio.file.Paths.get(keysFile), java.nio.charset.StandardCharsets.UTF_8);
		java.io.PrintStream console = System.out;
		java.io.PrintStream quiet = new java.io.PrintStream(java.io.OutputStream.nullOutputStream());
		out.println("language\tkey\ttext\theader");
		for (String language : new String[] { "en/", "cu/ru/", "el/mono/", "fr/", "zh/Hans/", "zh/Hant/" })
		{
			OrderedHashtable info = new OrderedHashtable();
			info.put("LS", language);
			for (String key : keys)
			{
				if (key.isEmpty())
				{
					continue;
				}
				System.setOut(quiet);
				String text;
				String header;
				try
				{
					ReadText reader = new ReadText(info);
					text = reader.readText("xml/Services/" + key + ".xml");
					header = reader.readHeader("xml/Services/" + key + ".xml");
				}
				finally
				{
					System.setOut(console);
				}
				out.println(language + "\t" + key + "\t" + (text == null || text.length() == 0 ? "-" : fingerprint(text)) + "\t" + (header == null || header.length() == 0 ? "-" : fingerprint(header)));
			}
		}
	}

	private static String cell(Object value)
	{
		return value == null ? "-" : clean(value.toString());
	}

	// Upstream leaves the readers of the scratch files open, which blocks changing them on Windows until they are collected.
	private static void changeFile(String path, byte[] content) throws Exception
	{
		for (int attempt = 0; ; attempt++)
		{
			try
			{
				if (content == null)
				{
					java.nio.file.Files.deleteIfExists(java.nio.file.Paths.get(path));
				}
				else
				{
					java.nio.file.Files.write(java.nio.file.Paths.get(path), content);
				}
				return;
			}
			catch (java.nio.file.FileSystemException e)
			{
				if (attempt >= 50)
				{
					throw e;
				}
				System.gc();
				Thread.sleep(20);
			}
		}
	}

	private static String fileValue(String path, String pattern)
	{
		try
		{
			String data = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(path)), java.nio.charset.StandardCharsets.UTF_8);
			java.util.regex.Matcher m = java.util.regex.Pattern.compile(pattern).matcher(data);
			return m.find() ? m.group(1) : "?";
		}
		catch (java.io.IOException e)
		{
			return "-";
		}
	}

	// What RoyalHours composes on every day: whether it serves, the flag it settles on, and the directives its template yields.
	// It opens a window as its last step, which fails headless, after composing. Run with cwd = vendor/ponomar.
	private static void royal(PrintWriter out, String yearList) throws Exception
	{
		java.io.PrintStream console = System.out;
		java.io.PrintStream quiet = new java.io.PrintStream(java.io.OutputStream.nullOutputStream());
		out.println(String.join("\t", "language", "year", "month", "day", "served", "PFlag", "lines", "trace"));
		for (String language : new String[] { "en/", "cu/ru/", "fr/", "el/mono/" })
		{
			for (String yearText : yearList.split(","))
			{
				int year = Integer.parseInt(yearText);
				JDate pascha = Paschalion.getPascha(year);
				JDate previous = Paschalion.getPascha(year - 1);
				JDate next = Paschalion.getPascha(year + 1);
				long first = new JDate(1, 1, year).getJulianDay();
				long last = new JDate(12, 31, year).getJulianDay();
				for (long j = first; j <= last; j++)
				{
					JDate today = new JDate(j);
					int nday = (int) JDate.difference(today, pascha);
					int ndayP = (int) JDate.difference(today, previous);
					OrderedHashtable info = new OrderedHashtable();
					info.put("dow", today.getDayOfWeek());
					info.put("doy", today.getDoy());
					info.put("nday", nday);
					info.put("ndayP", ndayP);
					info.put("ndayF", (int) JDate.difference(today, next));
					info.put("GS", 0);
					info.put("LS", language);
					info.put("Year", today.getYear());
					info.put("dRank", 0);
					info.put("Ideographic", "0");
					info.put("ReadSep", "; ");
					info.put("Tone", -1);
					int m = today.getMonth();
					int d = today.getDay();

					System.setOut(quiet);
					try
					{
						try
						{
							new RoyalHours(today, info);
						}
						catch (Throwable expected)
						{
							// The window cannot open headless; composing is done by then.
						}
						boolean served = info.get("PFlag") != null;
						TraceService service = new TraceService(info);
						if (served)
						{
							service.startService("xml/Services/RoyalHours.xml");
						}
						System.setOut(console);
						if (served && System.getProperty("golden.dump") != null)
						{
							java.nio.file.Files.write(java.nio.file.Paths.get(System.getProperty("golden.dump") + language.replace('/', '_') + year + "-" + m + "-" + d + ".txt"), service.trace, java.nio.charset.StandardCharsets.UTF_8);
						}
						out.println(String.join("\t", language, "" + year, "" + m, "" + d, served ? "1" : "0", cell(info.get("PFlag")), "" + service.trace.size(), fingerprint(String.join("\n", service.trace))));
					}
					finally
					{
						System.setOut(console);
					}
				}
			}
		}
	}

	// The scratch files of a language and of every language it falls back to: upstream reads them with that fallback.
	private static java.util.List<String> scratchPaths(String language, String[] files)
	{
		java.util.List<String> paths = new java.util.ArrayList<String>();
		String prefix = language;
		while (true)
		{
			for (String file : files)
			{
				paths.add("Ponomar/languages/" + prefix + "xml/Services/Var/" + file + ".xml");
			}
			if (prefix.isEmpty())
			{
				return paths;
			}
			int cut = prefix.lastIndexOf('/', prefix.length() - 2);
			prefix = cut < 0 ? "" : prefix.substring(0, cut + 1);
		}
	}

	// What the hour classes compose for a day: the type and flags each settles on, the scratch files it writes for its template, and
	// the directives the template then yields. Each class opens a window as its last step, which fails headless, after composing.
	// Run with cwd = vendor/ponomar. The scratch files they write and read are saved and restored around the run.
	private static void hours(PrintWriter out, int stride, String yearList) throws Exception
	{
		ConfigurationFiles.Defaults = new OrderedHashtable();
		ConfigurationFiles.ReadFile();
		java.lang.reflect.Field commemorations = Day.class.getDeclaredField("OrderedCommemorations");
		commemorations.setAccessible(true);
		String[] hourNames = { "primes", "terce", "sexte", "none" };
		Class<?>[] hourClasses = { Primes.class, ThirdHour.class, SixthHour.class, NinthHour.class };
		String[] templates = { "Prime", "ThirdHour", "SixthHour", "NinthHour" };
		// The scratch files holding the first troparion slot, the second, the kontakion and the Kathisma of each hour.
		String[][] hourFiles = { { "PTrop1", "PTrop2", "PKont1", "PKath" }, { "PTrop31", "PTrop32", "PKont3", "PKath3" }, { "PTrop61", "PTrop62", "PKont6", "PKath6" }, { "PTrop91", "PTrop92", "PKont9", "PKath9" } };
		java.lang.reflect.Field[] typeFields = new java.lang.reflect.Field[4];
		for (int h = 0; h < 4; h++)
		{
			typeFields[h] = hourClasses[h].getDeclaredField("Type");
			typeFields[h].setAccessible(true);
		}
		java.lang.reflect.Field whoField = PrimeSelector.class.getDeclaredField("LastLocation");
		whoField.setAccessible(true);
		java.lang.reflect.Field partsField = PrimeSelector.class.getDeclaredField("LastLocation2");
		partsField.setAccessible(true);
		String[] whos = { "Reader", "Priest" };
		String[] parts = { "Independent", "W.Beginning", "W.Ending", "W.BeginningEnding" };
		String[] scratch = { "PTrop1", "PTrop2", "PKont1", "PKath", "PTrop31", "PTrop32", "PKont3", "PKath3", "PTrop61", "PTrop62", "PKont6", "PKath6", "PTrop91", "PTrop92", "PKont9", "PKath9",
			"TP6R", "TP6C", "PROK61R", "PROK61C", "STYX61R", "STYX61C", "PROK61a", "PROK61b", "Intro6", "Reading6", "PROK62R", "PROK62C", "STYX62R", "STYX62C", "PROK62a", "PROK62b" };
		String[] languages = { "en/", "cu/ru/", "fr/", "el/mono/" };
		java.io.PrintStream console = System.out;
		java.io.PrintStream quiet = new java.io.PrintStream(java.io.OutputStream.nullOutputStream());
		java.util.Map<String, byte[]> saved = new java.util.HashMap<String, byte[]>();
		// Upstream opens its scratch files for writing without creating the directory, which Greek lacks; give it one for the run.
		java.util.List<java.io.File> createdDirs = new java.util.ArrayList<java.io.File>();
		for (String language : languages)
		{
			java.io.File dir = new java.io.File("Ponomar/languages/" + language + "xml/Services/Var");
			java.io.File made = dir;
			while (made != null && !made.exists())
			{
				createdDirs.add(made);
				made = made.getParentFile();
			}
			dir.mkdirs();
		}
		for (String language : languages)
		{
			for (String path : scratchPaths(language, scratch))
			{
				if (new java.io.File(path).exists())
				{
					saved.put(path, java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(path)));
				}
			}
		}
		out.println(String.join("\t", "language", "year", "month", "day", "hour", "who", "parts", "type", "PS", "PFlag1", "PFlag2", "PFlag3", "trop1", "trop2", "kont", "kath", "lines", "trace"));
		try
		{
			int count = 0;
			for (String language : languages)
			{
				for (String yearText : yearList.split(","))
				{
					int year = Integer.parseInt(yearText);
					JDate pascha = Paschalion.getPascha(year);
					JDate previous = Paschalion.getPascha(year - 1);
					JDate next = Paschalion.getPascha(year + 1);
					long first = new JDate(1, 1, year).getJulianDay();
					long last = new JDate(12, 31, year).getJulianDay();
					for (long j = first; j <= last; j += stride)
					{
						JDate today = new JDate(j);
						int nday = (int) JDate.difference(today, pascha);
						int ndayP = (int) JDate.difference(today, previous);
						OrderedHashtable info = new OrderedHashtable();
						info.put("dow", today.getDayOfWeek());
						info.put("doy", today.getDoy());
						info.put("nday", nday);
						info.put("ndayP", ndayP);
						info.put("ndayF", (int) JDate.difference(today, next));
						info.put("GS", 0);
						info.put("LS", language);
						info.put("Year", today.getYear());
						info.put("dRank", 0);
						info.put("Ideographic", "0");
						info.put("ReadSep", "; ");

						String folder = nday >= -70 && nday < 0 ? "xml/triodion/" : "xml/pentecostarion/";
						int line = nday >= -70 && nday < 0 ? Math.abs(nday) : (nday < -70 ? ndayP + 1 : nday + 1);
						int m = today.getMonth();
						int d = today.getDay();
						Day paschal = new Day(folder + (line >= 10 ? Integer.toString(line) : "0" + line), info);
						Day menaion = new Day("xml/" + (m < 10 ? "0" + m : "" + m) + (d < 10 ? "/0" + d : "/" + d), info);
						try
						{
							info.put("dRank", Math.max(menaion.getDayRank(), paschal.getDayRank()));
						}
						catch (Throwable broken)
						{
							// A day file naming a commemoration that cannot be ranked (fr 050307;) stops upstream before any service.
							count++;
							out.println(String.join("\t", language, "" + year, "" + m, "" + d, "-", "-", "-", "ERR"));
							continue;
						}
						info.put("Tone", paschal.getTone());

						// Cycle the hours and options so that every combination is exercised across the days.
						int h = (count / 8) % 4;
						String who = whos[count % 2];
						String part = parts[(count / 2) % 4];
						count++;
						whoField.set(null, who);
						partsField.set(null, part);
						for (String path : scratchPaths(language, scratch))
						{
							changeFile(path, null);
						}

						String type;
						System.setOut(quiet);
						try
						{
							typeFields[h].set(null, null);
							try
							{
								switch (h)
								{
									case 0: new Primes(today, info); break;
									case 1: new ThirdHour(today, info); break;
									case 2: new SixthHour(today, info); break;
									default: new NinthHour(today, info); break;
								}
							}
							catch (Throwable expected)
							{
								// The window cannot open headless; composing is done by then.
							}
							Object t = typeFields[h].get(null);
							type = t == null ? "-" : t.toString();

							String template = type.equals("Paschal") ? "xml/Services/PaschalHours.xml" : "xml/Services/" + templates[h] + ".xml";
							TraceService service = new TraceService(info);
							if (!type.equals("None") && !type.equals("-"))
							{
								service.startService(template);
							}
							String joined = String.join("\n", service.trace);
							String var = "Ponomar/languages/" + language + "xml/Services/Var/";
							System.setOut(console);
							out.println(String.join("\t", language, "" + year, "" + m, "" + d, hourNames[h], who, part, type,
								cell(info.get("PS")), cell(info.get("PFlag1")), cell(info.get("PFlag2")), cell(info.get("PFlag3")),
								fileValue(var + hourFiles[h][0] + ".xml", "What=\"([^\"]*)\""), fileValue(var + hourFiles[h][1] + ".xml", "What=\"([^\"]*)\""),
								fileValue(var + hourFiles[h][2] + ".xml", "What=\"([^\"]*)\""), fileValue(var + hourFiles[h][3] + ".xml", "File=\"([^\"]*)\""),
								"" + service.trace.size(), fingerprint(joined)));
						}
						finally
						{
							System.setOut(console);
						}
					}
				}
			}
		}
		finally
		{
			for (String language : languages)
			{
				for (String path : scratchPaths(language, scratch))
				{
					if (saved.containsKey(path))
					{
						changeFile(path, saved.get(path));
					}
					else
					{
						changeFile(path, null);
					}
				}
			}
			for (java.io.File dir : createdDirs)
			{
				changeFile(dir.getPath(), null);
			}
		}
	}

	// Places for the sunrise oracle: the configured default, mid-latitudes, the Southern Hemisphere, and polar cases where the sun
	// never rises or never sets. Each is name, longitude, latitude, time zone.
	private static final Object[][] PLACES = {
		{ "default", 45.0, 51.0, 1 }, { "moscow", 37.62, 55.75, 3 }, { "jordanville", -74.99, 42.93, -5 }, { "sydney", 151.2, -33.87, 10 },
		{ "equator", 0.0, 0.0, 0 }, { "reykjavik", -21.9, 64.15, 0 }, { "tromso", 18.96, 69.65, 1 }, { "mcmurdo", 166.67, -77.85, 12 } };

	// Sunrise.getSunriseSunset as raw decimal hours, for the places above with the options cycled (daylight saving, altitude).
	private static void sun(PrintWriter out, int stride, String yearList)
	{
		double[] altitudes = { -0.833, -6.0, -12.0, -18.0, 0.0 };
		out.println("year\tmonth\tday\tplace\tdst\taltitude\tsunrise\tsunset");
		int count = 0;
		for (String yearText : yearList.split(","))
		{
			int year = Integer.parseInt(yearText);
			for (long j = new JDate(1, 1, year).getJulianDay(); j <= new JDate(12, 31, year).getJulianDay(); j += stride)
			{
				JDate today = new JDate(j);
				for (Object[] place : PLACES)
				{
					boolean dst = count % 2 == 1;
					double altitude = altitudes[(count / 2) % altitudes.length];
					count++;
					double[] hours = Sunrise.getSunriseSunset(today, (Double) place[1], (Double) place[2], (Integer) place[3], dst, altitude);
					out.println(String.join("\t", "" + year, "" + today.getMonth(), "" + today.getDay(), (String) place[0], dst ? "1" : "0", Double.toString(altitude), Double.toString(hours[0]), Double.toString(hours[1])));
				}
			}
		}
	}

	// Sunrise.getSunriseSunsetString: the times as each language writes them, with and without ideographic numerals.
	// Run with cwd = vendor/ponomar.
	private static void suntime(PrintWriter out, int stride, String yearList)
	{
		Object[][] languages = { { "en/", "0" }, { "cu/", "0" }, { "cu/", "1" }, { "cu/ru/", "0" }, { "fr/", "0" }, { "zh/Hans/", "1" }, { "el/mono/", "1" } };
		Object[][] places = { PLACES[0], PLACES[1], PLACES[6] };
		java.io.PrintStream console = System.out;
		java.io.PrintStream quiet = new java.io.PrintStream(java.io.OutputStream.nullOutputStream());
		out.println("language\tideographic\tyear\tmonth\tday\tplace\tsunrise\tsunset");
		for (Object[] language : languages)
		{
			OrderedHashtable info = new OrderedHashtable();
			info.put("LS", language[0]);
			info.put("Ideographic", language[1]);
			System.setOut(quiet);
			try
			{
				new Sunrise(info);
				for (String yearText : yearList.split(","))
				{
					int year = Integer.parseInt(yearText);
					for (long j = new JDate(1, 1, year).getJulianDay(); j <= new JDate(12, 31, year).getJulianDay(); j += stride)
					{
						JDate today = new JDate(j);
						for (Object[] place : places)
						{
							String[] times;
							try
							{
								times = Sunrise.getSunriseSunsetString(today, (Double) place[1], (Double) place[2], (Integer) place[3]);
							}
							catch (Throwable t)
							{
								times = new String[] { "ERR", "ERR" };
							}
							out.println(String.join("\t", (String) language[0], (String) language[1], "" + year, "" + today.getMonth(), "" + today.getDay(), (String) place[0], clean(times[0]), clean(times[1])));
						}
					}
				}
			}
			finally
			{
				System.setOut(console);
			}
		}
	}

	// Astronomy.lunarage (degrees between the moon and the sun) and lunarphase in four languages. Run with cwd = vendor/ponomar.
	private static void moon(PrintWriter out, int stride, String yearList)
	{
		String[] languages = { "en/", "cu/ru/", "fr/", "zh/Hans/" };
		Astronomy sky = new Astronomy();
		java.io.PrintStream console = System.out;
		java.io.PrintStream quiet = new java.io.PrintStream(java.io.OutputStream.nullOutputStream());
		out.println("year\tmonth\tday\tjdn\tage\t" + String.join("\t", languages));
		System.setOut(quiet);
		try
		{
			for (String yearText : yearList.split(","))
			{
				int year = Integer.parseInt(yearText);
				for (long j = new JDate(1, 1, year).getJulianDay(); j <= new JDate(12, 31, year).getJulianDay(); j += stride)
				{
					JDate today = new JDate(j);
					StringBuilder row = new StringBuilder(year + "\t" + today.getMonth() + "\t" + today.getDay() + "\t" + j + "\t" + Double.toString(sky.lunarage(j)));
					for (String language : languages)
					{
						OrderedHashtable info = new OrderedHashtable();
						info.put("LS", language);
						row.append('\t').append(clean(sky.lunarphase(j, info)));
					}
					out.println(row);
				}
			}
		}
		finally
		{
			System.setOut(console);
		}
	}

	// RuleBasedNumber.getFormattedNumber for a spread of numbers in every language with rules, and in one without. Run with cwd = vendor/ponomar.
	private static void numbers(PrintWriter out)
	{
		java.util.List<Long> values = new java.util.ArrayList<Long>();
		for (long n = 0; n <= 3000; n++)
		{
			values.add(n);
		}
		for (long n = 3001; n <= 20000; n += 7)
		{
			values.add(n);
		}
		for (long n : new long[] { 4999, 5000, 9999, 10000, 10001, 12345, 99999, 100000, 100001, 123456, 999999, 1000000, 1000001, 1234567, 9999999, 10000000, 10000001, 12345678, 99999999, 100000000, 100000001, 123456789, 999999999, 1000000000, 1000000001, 1234567890L, 9999999999L, 10000000000L, 10000000001L, 99999999999L })
		{
			values.add(n);
		}
		out.println("language\tnumber\ttext");
		for (String language : new String[] { "", "en/", "fr/", "cu/ru/", "el/mono/", "zh/Hans/", "zh/Hant/" })
		{
			OrderedHashtable info = new OrderedHashtable();
			info.put("LS", language);
			RuleBasedNumber rules = new RuleBasedNumber(info);
			for (long n : values)
			{
				String text;
				try
				{
					text = rules.getFormattedNumber((double) n);
				}
				catch (Throwable t)
				{
					text = "ERR";
				}
				out.println(language + "\t" + n + "\t" + clean(text));
			}
		}
	}

	// What a commemoration's life file yields on each day it occurs: its names in every grammatical form, its life, and the
	// Liturgy troparia and kontakia (as DoSaint1 shows them). One row per distinct result; the date says which context gave it.
	private static void lives(PrintWriter out, String yearList) throws Exception
	{
		String[] languages = { "en/", "cu/ru/", "el/mono/", "fr/", "zh/Hans/", "zh/Hant/" };
		java.lang.reflect.Field commemorations = Day.class.getDeclaredField("OrderedCommemorations");
		commemorations.setAccessible(true);
		java.lang.reflect.Field information = Commemoration1.class.getDeclaredField("Information");
		information.setAccessible(true);
		java.lang.reflect.Field services = Commemoration1.class.getDeclaredField("ServiceInfo");
		services.setAccessible(true);
		String[] forms = { "Nominative", "Genetive", "Dative", "Possessive", "Short", "ShortF", "Name", "Index" };
		String[] hymnNodes = { "/LITURGY/TROPARION", "/LITURGY/KONTAKION" };
		out.println(String.join("\t", "language", "year", "month", "day", "cid", "nominative", "genitive", "dative", "possessive", "short", "shortF", "name", "index", "life", "copyright", "lifeId", "troparion1", "troparion2", "kontakion1", "kontakion2", "label"));
		java.util.Set<String> seen = new java.util.HashSet<String>();
		for (String language : languages)
		{
			OrderedHashtable base = new OrderedHashtable();
			base.put("LS", language);
			String errorName = (String) new LanguagePack(base).Phrases.get("Commemoration3");
			for (String yearText : yearList.split(","))
			{
				int year = Integer.parseInt(yearText);
				JDate pascha = Paschalion.getPascha(year);
				JDate previous = Paschalion.getPascha(year - 1);
				JDate next = Paschalion.getPascha(year + 1);
				long first = new JDate(1, 1, year).getJulianDay();
				long last = new JDate(12, 31, year).getJulianDay();
				for (long j = first; j <= last; j++)
				{
					JDate today = new JDate(j);
					int nday = (int) JDate.difference(today, pascha);
					int ndayP = (int) JDate.difference(today, previous);
					OrderedHashtable info = new OrderedHashtable();
					info.put("dow", today.getDayOfWeek());
					info.put("doy", today.getDoy());
					info.put("nday", nday);
					info.put("ndayP", ndayP);
					info.put("ndayF", (int) JDate.difference(today, next));
					info.put("GS", 0);
					info.put("LS", language);
					info.put("Year", today.getYear());
					info.put("dRank", 0);
					info.put("Ideographic", "0");
					info.put("ReadSep", "; ");

					String folder = nday >= -70 && nday < 0 ? "xml/triodion/" : "xml/pentecostarion/";
					int line = nday >= -70 && nday < 0 ? Math.abs(nday) : (nday < -70 ? ndayP + 1 : nday + 1);
					int m = today.getMonth();
					int d = today.getDay();
					Day paschal = new Day(folder + (line >= 10 ? Integer.toString(line) : "0" + line), info);
					Day menaion = new Day("xml/" + (m < 10 ? "0" + m : "" + m) + (d < 10 ? "/0" + d : "/" + d), info);

					for (Day part : new Day[] { menaion, paschal })
					{
						java.util.Vector list = (java.util.Vector) commemorations.get(part);
						// The tag Main shows after a commemoration's readings, one entry per commemoration in order.
						OrderedHashtable[] labelled;
						try
						{
							labelled = list.isEmpty() ? null : part.getReadings();
						}
						catch (NumberFormatException failure)
						{
							// fr/xml/05/03.xml names the commemoration "050307;", which Commemoration1.getRank cannot parse.
							System.err.println("SKIP " + language + year + "-" + m + "-" + d + ": " + failure.getMessage());
							continue;
						}
						int position = 0;
						for (Object item : list)
						{
							Commemoration1 c = (Commemoration1) item;
							OrderedHashtable entry = (OrderedHashtable) labelled[position++].get("Readings");
							StringBuilder row = new StringBuilder(c.getCId());
							for (String form : forms)
							{
								String value;
								try
								{
									value = c.getGrammar(form);
								}
								catch (Throwable t)
								{
									value = "!";
								}
								// An error name means upstream found neither the form nor a nominative.
								row.append('\t').append(value == null || value.equals(errorName) ? "-" : clean(value));
							}
							String life = c.getLife();
							row.append('\t').append(life == null ? "-" : fingerprint(life));
							String copyright = c.getLifeCopyright();
							row.append('\t').append(copyright == null ? "-" : clean(copyright));
							Object lifeId = ((OrderedHashtable) information.get(c)).get("LifeID");
							row.append('\t').append(lifeId == null ? "-" : clean(lifeId.toString()));
							OrderedHashtable service = (OrderedHashtable) services.get(c);
							for (String node : hymnNodes)
							{
								for (String type : new String[] { "1", "2" })
								{
									Object stuff = service == null ? null : service.get(node);
									Object hymn = stuff == null ? null : ((OrderedHashtable) stuff).get(type);
									if (hymn == null)
									{
										row.append("\t-");
										continue;
									}
									OrderedHashtable table = (OrderedHashtable) hymn;
									Object tone = table.get("Tone");
									Object podoben = table.get("Podoben");
									Object text = table.get("text");
									row.append('\t').append(tone == null ? "" : clean(tone.toString())).append('/').append(podoben == null ? "" : clean(podoben.toString())).append('/').append(text == null ? "-" : fingerprint(text.toString()));
								}
							}
							row.append('\t').append(clean(entry.get("Name").toString()));
							String key = language + "\t" + row;
							if (seen.add(key))
							{
								int at = key.indexOf('\t') + 1;
								out.println(language + "\t" + year + "\t" + m + "\t" + d + "\t" + key.substring(at));
							}
						}
					}
				}
			}
		}
	}

	// One output line per expression: its upstream eval() result in each context, or E when upstream throws.
	private static void dsl(PrintWriter out) throws IOException
	{
		java.util.List<String> expressions = java.nio.file.Files.readAllLines(java.nio.file.Paths.get("scratch/golden/dsl-expressions.txt"), java.nio.charset.StandardCharsets.UTF_8);
		java.util.List<String> contexts = java.nio.file.Files.readAllLines(java.nio.file.Paths.get("scratch/golden/dsl-contexts.csv"), java.nio.charset.StandardCharsets.UTF_8);
		String[] names = contexts.get(0).split(",");
		for (String expression : expressions)
		{
			StringBuilder row = new StringBuilder();
			for (int c = 1; c < contexts.size(); c++)
			{
				StringOp op = new StringOp();
				String[] values = contexts.get(c).split(",");
				for (int i = 0; i < names.length; i++)
				{
					op.dayInfo.put(names[i], Integer.valueOf(values[i]));
				}
				String result;
				try
				{
					result = Double.toString(op.eval(expression));
				}
				catch (Throwable t)
				{
					result = "E";
				}
				if (c > 1)
				{
					row.append(',');
				}
				row.append(result);
			}
			out.println(row);
		}
	}

	// What Main.write() derives for a date: day variables, the Triodion/Pentecostarion and Menaion files it opens,
	// and the commemorations (sid:cid:rank) each yields once Cmd guards are applied. Run with cwd = vendor/ponomar.
	private static void day(PrintWriter out, int stride, String yearList) throws Exception
	{
		String[] languages = { "en/", "cu/ru/", "el/mono/", "fr/", "zh/Hans/", "zh/Hant/" };
		java.lang.reflect.Field field = Day.class.getDeclaredField("OrderedCommemorations");
		field.setAccessible(true);
		java.lang.reflect.Field fastField = Fasting.class.getDeclaredField("Fast");
		fastField.setAccessible(true);
		out.println(String.join("\t", "language", "gs", "year", "month", "day", "nday", "ndayP", "ndayF", "doy", "dow", "paschalFile", "paschal", "menaion", "rankPaschal", "rankMenaion", "dRank", "tone", "fastLevel", "fastText"));
		for (String language : languages)
		{
			for (int gs = 0; gs <= 1; gs++)
			{
				for (String yearText : yearList.split(","))
				{
					int year = Integer.parseInt(yearText);
					JDate pascha = Paschalion.getPascha(year);
					JDate previous = Paschalion.getPascha(year - 1);
					JDate next = Paschalion.getPascha(year + 1);
					long first = new JDate(1, 1, year).getJulianDay();
					long last = new JDate(12, 31, year).getJulianDay();
					for (long j = first; j <= last; j += stride)
					{
						JDate today = new JDate(j);
						int dow = today.getDayOfWeek();
						int doy = today.getDoy();
						int nday = (int) JDate.difference(today, pascha);
						int ndayP = (int) JDate.difference(today, previous);
						int ndayF = (int) JDate.difference(today, next);
						OrderedHashtable info = new OrderedHashtable();
						info.put("dow", dow);
						info.put("doy", doy);
						info.put("nday", nday);
						info.put("ndayP", ndayP);
						info.put("ndayF", ndayF);
						info.put("GS", gs);
						info.put("LS", language);
						info.put("Year", today.getYear());
						info.put("dRank", 0);
						info.put("Ideographic", "0");

						String folder;
						int line;
						if (nday >= -70 && nday < 0)
						{
							folder = "xml/triodion/";
							line = Math.abs(nday);
						}
						else if (nday < -70)
						{
							folder = "xml/pentecostarion/";
							line = ndayP + 1;
						}
						else
						{
							folder = "xml/pentecostarion/";
							line = nday + 1;
						}
						String paschalFile = folder + (line >= 10 ? Integer.toString(line) : "0" + line);
						int m = today.getMonth();
						int d = today.getDay();
						String menaionFile = "xml/" + (m < 10 ? "0" + m : "" + m) + (d < 10 ? "/0" + d : "/" + d);

						Day paschal = new Day(paschalFile, info);
						Day menaion = new Day(menaionFile, info);
						int rankPaschal;
						int rankMenaion;
						try
						{
							rankPaschal = paschal.getDayRank();
							rankMenaion = menaion.getDayRank();
						}
						catch (NumberFormatException failure)
						{
							// fr/xml/05/03.xml names the commemoration "050307;", which Commemoration1.getRank cannot parse.
							System.err.println("SKIP " + language + year + "-" + m + "-" + d + " gs" + gs + ": " + failure.getMessage());
							continue;
						}
						int dRank = Math.max(rankPaschal, rankMenaion);
						// As Main.write(): fasting runs once dRank holds the day's rank.
						info.put("dRank", dRank);
						String fastLevel;
						String fastText;
						try
						{
							fastText = new Fasting(info).FastRules();
							fastLevel = (String) fastField.get(null);
						}
						catch (Throwable t)
						{
							fastText = "ERR";
							fastLevel = "ERR";
						}
						out.println(String.join("\t", language, "" + gs, "" + year, "" + m, "" + d, "" + nday, "" + ndayP, "" + ndayF, "" + doy, "" + dow,
							paschalFile, describe(field, paschal), describe(field, menaion), "" + rankPaschal, "" + rankMenaion,
							"" + Math.max(rankPaschal, rankMenaion), "" + paschal.getTone(), fastLevel, String.valueOf(fastText).replace('\t', ' ').replace('\n', ' ')));
					}
				}
			}
		}
	}

	private static String describe(java.lang.reflect.Field field, Day day) throws Exception
	{
		StringBuilder text = new StringBuilder();
		for (Object item : (java.util.Vector) field.get(day))
		{
			Commemoration1 c = (Commemoration1) item;
			if (text.length() > 0)
			{
				text.append('|');
			}
			text.append(c.getSId()).append(':').append(c.getCId()).append(':').append(c.getRank());
		}
		return text.toString();
	}

	private static String ymd(JDate d)
	{
		return d.getYear() + "-" + d.getMonth() + "-" + d.getDay();
	}

	private static void jdate(PrintWriter out, int stride)
	{
		out.println("jdn,year,month,day,dow,doy");
		long first = new JDate(1, 1, 33).getJulianDay();
		long last = new JDate(12, 31, 3000).getJulianDay();
		for (long j = first; j <= last; j += stride)
		{
			JDate d = new JDate(j);
			out.println(j + "," + d.getYear() + "," + d.getMonth() + "," + d.getDay() + "," + d.getDayOfWeek() + "," + d.getDoy());
		}
	}

	private static void pascha(PrintWriter out)
	{
		out.println("year,pascha,pentecost,lentStart,apostlesFastStart,apostlesFastLength,keyOfBoundaries,indiction,solarCycle,lunarCycle");
		for (int y = 33; y <= 3000; y++)
		{
			out.println(y + "," + ymd(Paschalion.getPascha(y)) + "," + ymd(Paschalion.getPentecost(y)) + ","
				+ ymd(Paschalion.getLentStart(y)) + "," + ymd(Paschalion.getApostlesFastStart(y)) + ","
				+ Paschalion.getApostlesFastLength(y) + "," + Paschalion.getKeyOfBoundaries(y) + ","
				+ Paschalion.getIndiction(y) + "," + Paschalion.getSolarCycle(y) + "," + Paschalion.getLunarCycle(y));
		}
	}

	private static void pcalendar(PrintWriter out, int stride)
	{
		out.println("calendar,year,month,day,julianDay,am,yearJ,monthJ,dayJ,yearG,monthG,dayG");
		long first = new JDate(1, 1, 33).getJulianDay();
		long last = new JDate(12, 31, 3000).getJulianDay();
		OrderedHashtable info = new OrderedHashtable();
		info.put("LS", "en/");
		for (long j = first; j <= last; j += stride)
		{
			JDate d = new JDate(j);
			for (String cal : new String[] { PCalendar.julian, PCalendar.gregorian })
			{
				PCalendar p = new PCalendar(d, cal, info);
				out.println(cal + "," + d.getYear() + "," + d.getMonth() + "," + d.getDay() + "," + p.getJulianDay() + "," + p.getAM() + ","
					+ p.getYearJ() + "," + p.getMonthJ() + "," + p.getDayJ() + "," + p.getYearG() + "," + p.getMonthG() + "," + p.getDayG());
			}
		}
	}
}
