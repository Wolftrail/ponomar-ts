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
		String[] languages = { "en/", "cu/ru/", "el/mono/" };
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
						info.put("dRank", Math.max(menaion.getDayRank(), paschal.getDayRank()));

						// As Main: the menaion's commemorations first, then the Triodion or Pentecostarion's.
						java.util.Vector entries = new java.util.Vector();
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
		String[] languages = { "en/", "cu/ru/", "el/mono/" };
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
						int rankPaschal = paschal.getDayRank();
						int rankMenaion = menaion.getDayRank();
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
